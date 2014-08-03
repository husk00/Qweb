#    wikipedia.py is part of Qweb by Luca Franceschini & Luca Carrubba.
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
	import os, sys, re
except:
	print "ERROR: can't load some libraries"

try:
	from pattern.web import plaintext, encode_utf8, Wikipedia
except:
	print "I'm loading pattern module from lib directory"
        MODULE_PATTERN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../lib/pattern")
        sys.path.append(MODULE_PATTERN)
        try:
	    from pattern.web import plaintext, encode_utf8, Wikipedia
        except:
	    print "ERROR: can't load pattern library"


class start(pyext._class):

    # number of inlets and outlets
    _inlets=3
    _outlets=4

    # constructor
    def __init__(self,*args):
        self._detach(1)
        print "wikipedia object loaded"

    def _anything_1(self,*args):
        if hasattr(self, 'lang'):
            lang = self.lang
        else:
            lang = "en"

        if hasattr(self, 'section'):
            defsection = self.section
        else:
            defsection = "MAIN"

        self.input = str(args[0])
        dbgmsg = "%s%s" % ("searching in wikipedia: ", self.input)
        self._outlet(4, dbgmsg)

        engine = Wikipedia(license=None, language=lang)
        results = engine.search(self.input)

        self._outlet(1, encode_utf8(plaintext(results.title)))
        
        splitter = r"\.(?!\d)"
        for section in results.sections:
            self._outlet(2, '  '*(section.level-1) + encode_utf8(plaintext(section.title)))

            if (defsection == "ALL"):
                paragrafi = re.split(splitter, encode_utf8(plaintext(section.string)))
                for x in xrange(len(paragrafi)-1):
                    self._outlet(3, paragrafi[x])
            elif (defsection == "MAIN") and (section.title == results.title):
                paragrafi = re.split(splitter, encode_utf8(plaintext(section.content)))
                for x in xrange(len(paragrafi)-1):
                    self._outlet(3, paragrafi[x])
            elif (defsection == section.title):
                paragrafi = re.split(splitter, encode_utf8(plaintext(section.content)))
                for x in xrange(len(paragrafi)-1):
                    self._outlet(3, paragrafi[x])

    def _anything_2(self,*args):
        self.lang = str(args[0])
        dbgmsg = "%s%s" % ("lang: ", self.lang)
        self._outlet(4, dbgmsg)

    def _anything_3(self,*args):
        section = []
        for arg in args:
            section.append(str(arg))
        self.section = ' '.join(section)
        dbgmsg = "%s%s" % ("section: ", self.section)
        self._outlet(4, dbgmsg)

