# -*- encoding:utf-8 -*-

from __future__ import unicode_literals

from sleekxmpp.test import *
import time
import threading


class TestStreamRoster(SleekTest):
    """
    Test handling roster updates.
    """

    def tearDown(self):
        self.stream_close()

    def testGetRoster(self):
        """Test handling roster requests."""
        self.stream_start(mode='client', jid='tester@localhost')

        events = []

        def roster_received(iq):
            events.append('roster_received')

        self.xmpp.add_event_handler('roster_received', roster_received)

        # Since get_roster blocks, we need to run it in a thread.
        t = threading.Thread(name='get_roster', target=self.xmpp.get_roster)
        t.start()

        self.send("""
          <iq type="get" id="1">
            <query xmlns="jabber:iq:roster" />
          </iq>
        """)
        self.recv("""
          <iq to='tester@localhost' type="result" id="1">
            <query xmlns="jabber:iq:roster">
              <item jid="user@localhost"
                    name="User"
                    subscription="from"
                    ask="subscribe">
                <group>Friends</group>
                <group>Examples</group>
              </item>
            </query>
          </iq>
        """)

        # Wait for get_roster to return.
        t.join()

        self.check_roster('tester@localhost', 'user@localhost',
                          name='User',
                          subscription='from',
                          afrom=True,
                          pending_out=True,
                          groups=['Friends', 'Examples'])

        # Give the event queue time to process.
        time.sleep(.1)

        self.failUnless('roster_received' in events,
                "Roster received event not triggered: %s" % events)

    def testRosterSet(self):
        """Test handling pushed roster updates."""
        self.stream_start(mode='client')
        events = []

        def roster_update(e):
            events.append('roster_update')

        self.xmpp.add_event_handler('roster_update', roster_update)

        self.recv("""
          <iq to='tester@localhost' type="set" id="1">
            <query xmlns="jabber:iq:roster">
              <item jid="user@localhost"
                    name="User"
                    subscription="both">
                <group>Friends</group>
                <group>Examples</group>
              </item>
            </query>
          </iq>
        """)
        self.send("""
          <iq type="result" id="1">
            <query xmlns="jabber:iq:roster" />
          </iq>
        """)

        self.check_roster('tester@localhost', 'user@localhost',
                          name='User',
                          subscription='both',
                          groups=['Friends', 'Examples'])

        # Give the event queue time to process.
        time.sleep(.1)

        self.failUnless('roster_update' in events,
                "Roster updated event not triggered: %s" % events)

    def testRosterTimeout(self):
        """Test handling a timed out roster request."""
        self.stream_start()

        def do_test():
            self.xmpp.get_roster(timeout=0)
            time.sleep(.1)

        self.assertRaises(IqTimeout, do_test)

    def testRosterCallback(self):
        """Test handling a roster request callback."""
        self.stream_start()
        events = []

        def roster_callback(iq):
            events.append('roster_callback')

        # Since get_roster blocks, we need to run it in a thread.
        t = threading.Thread(name='get_roster',
                             target=self.xmpp.get_roster,
                             kwargs={str('callback'): roster_callback})
        t.start()

        self.send("""
          <iq type="get" id="1">
            <query xmlns="jabber:iq:roster" />
          </iq>
        """)
        self.recv("""
          <iq type="result" id="1">
            <query xmlns="jabber:iq:roster">
              <item jid="user@localhost"
                    name="User"
                    subscription="both">
                <group>Friends</group>
                <group>Examples</group>
              </item>
            </query>
          </iq>
        """)

        # Wait for get_roster to return.
        t.join()

        # Give the event queue time to process.
        time.sleep(.1)

        self.failUnless(events == ['roster_callback'],
                 "Roster timeout event not triggered: %s." % events)

    def testRosterUnicode(self):
        """Test that JIDs with Unicode values are handled properly."""
        self.stream_start()
        self.recv("""
          <iq to="tester@localhost" type="set" id="1">
            <query xmlns="jabber:iq:roster">
              <item jid="andré@foo" subscription="both">
                <group>Unicode</group>
              </item>
            </query>
          </iq>
        """)

        # Give the event queue time to process.
        time.sleep(.1)

        self.check_roster('tester@localhost', 'andré@foo',
                          subscription='both',
                          groups=['Unicode'])

        jids = list(self.xmpp.client_roster.keys())
        self.failUnless(jids == ['andré@foo'],
                 "Too many roster entries found: %s" % jids)

        self.recv("""
          <presence to="tester@localhost" from="andré@foo/bar">
            <show>away</show>
            <status>Testing</status>
          </presence>
        """)

        # Give the event queue time to process.
        time.sleep(.1)

        result = self.xmpp.client_roster['andré@foo'].resources
        expected = {'bar': {'status':'Testing',
                            'show':'away',
                            'priority':0}}
        self.failUnless(result == expected,
                "Unexpected roster values: %s" % result)

    def testSendLastPresence(self):
        """Test that sending the last presence works."""
        self.stream_start()
        self.xmpp.send_presence(pshow='dnd')
        self.xmpp.auto_authorize = True
        self.xmpp.auto_subscribe = True

        self.send("""
          <presence>
            <show>dnd</show>
          </presence>
        """)

        self.recv("""
          <presence from="user@localhost"
                    to="tester@localhost"
                    type="subscribe" />
        """)

        self.send("""
          <presence to="user@localhost"
                    type="subscribed" />
        """)

        self.send("""
          <presence to="user@localhost">
            <show>dnd</show>
          </presence>
        """)


suite = unittest.TestLoader().loadTestsFromTestCase(TestStreamRoster)
