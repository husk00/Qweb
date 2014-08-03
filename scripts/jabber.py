#    jabber.py is part of Qweb by Luca Franceschini & Luca Carrubba.
#    For info: www.gemq.info
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

try:
	import pyext
except:
	print "ERROR: This script must be loaded by the PD/Max pyext external"

try:
	import os, re, sys, platform, subprocess, logging
except:
	print "ERROR: can't load some libraries"

try:
        from sleekxmpp import ClientXMPP
        from sleekxmpp.exceptions import IqError, IqTimeout
except:
	print "I'm loading sleekxmpp module from lib directory"
        MODULE_SLEEKXMPP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../lib/sleekxmpp")
        sys.path.append(MODULE_SLEEKXMPP)
        try:
            from sleekxmpp import ClientXMPP
            from sleekxmpp.exceptions import IqError, IqTimeout
        except:
	    print "ERROR: can't load sleekxmpp library"

try:
        import dns.resolver
except:
	print "I'm loading dnspython module from lib directory"
        MODULE_DNSPYTHON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib/dnspython")
        sys.path.append(MODULE_DNSPYTHON)
        try:
	    import dns.resolver
        except:
	    print "ERROR: can't load dnspython library"



class start(pyext._class):

    # number of inlets and outlets
    _inlets=5
    _outlets=3

    # constructor
    def __init__(self,*args):
        self._detach(1)
        print "jabber object loaded"


    def _anything_1(self,*args):
        self.action = str(args[0])
        if self.action == "connect":
            if hasattr(self, 'xmpp'):
                self._outlet(3, "You are connected")
            else:
                if hasattr(self, 'jid') and hasattr(self, 'password'):
                    #logging.basicConfig(level=logging.DEBUG, format='%(levelname)-8s %(message)s')
                    self.xmpp = JabberBot(self.jid, self.password, self)
                    self.xmpp.connect()
                    self.xmpp.process(block=False)
                else:
                    self._outlet(3, "do you insert jid and password")
        elif self.action == "disconnect":
            if hasattr(self, 'xmpp'):
                self._outlet(3, "sono connesso, disconnetto")
                self.xmpp.disconnect()
                del self.xmpp

    def _anything_2(self,*args):
        self.jid = str(args[0])
        output = "%s%s" % ("jid: ", self.jid)
        self._outlet(3, output)

    def _anything_3(self,*args):
        self.password = str(args[0])
        output = "%s%s" % ("password: ", self.password)
        self._outlet(3, output)

    def _anything_4(self,*args):
        self.touser = str(args[0])
        output = "%s%s" % ("to user: ", self.touser)
        self._outlet(3, output)
    
    def _anything_5(self,*args):
        messaggio = []
        for arg in args:
            messaggio.append(str(arg))
        self.message = ' '.join(messaggio)
        if hasattr(self, 'touser'):
            output = "%s%s%s%s" % ("sending: ", self.message, " to user:", self.touser)
            self._outlet(3, output)
            self.xmpp.send_message(self.touser, self.message)
        else:
            self._outlet(3, "do you insert touser")  
   
    def msgout(self,msg):
        #msg = args[0]
        self._outlet(1,"%s" % msg['from'])
        self._outlet(2,"%s" % msg['body'])

#Bot jabber
class JabberBot(ClientXMPP):

    def __init__(self, jid, password, jabberobj):
        ClientXMPP.__init__(self, jid, password)
        self.jabberobj = jabberobj
        self.add_event_handler("session_start", self.session_start)
        self.add_event_handler("message", self.message)

        # If you wanted more functionality, here's how to register plugins:
        # self.register_plugin('xep_0030') # Service Discovery
        # self.register_plugin('xep_0199') # XMPP Ping

        # Here's how to access plugins once you've registered them:
        # self['xep_0030'].add_feature('echo_demo')

        # If you are working with an OpenFire server, you will
        # need to use a different SSL version:
        # import ssl
        # self.ssl_version = ssl.PROTOCOL_SSLv3

    def session_start(self, event):
        self.send_presence()
        self.get_roster()

        # Most get_*/set_* methods from plugins use Iq stanzas, which
        # can generate IqError and IqTimeout exceptions
        #
        # try:
        #     self.get_roster()
        # except IqError as err:
        #     logging.error('There was an error getting the roster')
        #     logging.error(err.iq['error']['condition'])
        #     self.disconnect()
        # except IqTimeout:
        #     logging.error('Server is taking too long to respond')
        #     self.disconnect()

    def message(self, msg):
        if msg['type'] in ('chat', 'normal'):
            self.jabberobj.msgout(msg)
            #msg.reply("Thanks for sending\n%(body)s" % msg).send()
