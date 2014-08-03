#    twitter.py is part of Qweb by Luca Franceschini & Luca Carrubba.
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
	import os, sys
except:
	print "ERROR: can't load some libraries"

try:
	from pattern.web import Twitter, plaintext, encode_utf8

except:
	print "I'm loading pattern module from lib directory"
        MODULE_PATTERN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../lib/pattern")
        sys.path.append(MODULE_PATTERN)
        try:
	    from pattern.web import Twitter, plaintext, encode_utf8
        except:
	    print "ERROR: can't load pattern library"


class start(pyext._class):

    # number of inlets and outlets
    _inlets=2
    _outlets=4

    # methods for all inlets
    howmany=15

    # constructor
    def __init__(self,*args):
        self._detach(1)
        print "twitter object loaded"

    def _anything_1(self,*args):
        tosearch = []
        for arg in args:
            tosearch.append(str(arg))
        self.input = ' '.join(tosearch)
        if hasattr(self, 'howmany'):
            howmany = self.howmany
        dbgmsg = "%s%d%s%s" % ("getting ", self.howmany, " results about: ", self.input)
        self._outlet(4, dbgmsg)
        for tweet in Twitter().search(self.input, cached=False)[:howmany]:
            author = encode_utf8(plaintext(tweet.author))
            date = encode_utf8(plaintext(tweet.date))
	    description = encode_utf8(plaintext(tweet.description))    
            self._outlet(1, description)
            self._outlet(2, author)
            self._outlet(3, date)

    def float_2(self,f):
        self.howmany = int(f)
        output = "%s%d" % ("how many: ", self.howmany)
        self._outlet(4, output)
