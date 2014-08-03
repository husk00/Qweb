#    imap.py is part of Qweb by Luca Franceschini & Luca Carrubba.
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
	from pattern.web import Mail, plaintext, encode_utf8
except:
	print "I'm loading pattern module from lib directory"
        MODULE_PATTERN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../lib/pattern")
        sys.path.append(MODULE_PATTERN)
        try:
	    from pattern.web import Mail, plaintext, encode_utf8
        except:
	    print "ERROR: can't load pattern library"


class start(pyext._class):

    # number of inlets and outlets
    _inlets=10
    _outlets=6

    # constructor
    def __init__(self,*args):
        self._detach(1)
        print "imap object loaded"

    def _anything_1(self,*args):

        #default vars
        varservice = 'imap.gmail.com'
        varport = 993
        varsecure = True
        varfolder = 'inbox'
        varquery = ''
        varfield = 'subject'
        howmany = 1

        if hasattr(self, 'service'):
            varservice = self.service
        if hasattr(self, 'port'):
            varport = self.port
        if hasattr(self, 'folder'):
            varfolder = self.folder
        if hasattr(self, 'search'):
            varquery = self.search
        if hasattr(self, 'howmany'):
            howmany = self.howmany

        if hasattr(self, 'username') and hasattr(self, 'passw'):
            self.input = str(args[0])
            mail = Mail(self.username, self.passw, service=varservice, port=varport)
            if self.input == "search":
                mailres = getattr(mail,varfolder).search(varquery, field=varfield)
                for amail in mailres[:howmany]:
                    m = getattr(mail,varfolder).read(amail)
                    self._outlet(2, encode_utf8(plaintext(m.author)))
                    self._outlet(3, encode_utf8(plaintext(m.subject)))
                    self._outlet(4, encode_utf8(plaintext(m.body)))
                    self._outlet(5, m.attachments)
            elif self.input == "getf":
                print mail.folders
                for folder in mail.folders.keys():
                    self._outlet(1, folder)
        else:
            self._outlet(6, "you need to insert username and password inlets")

    def _anything_2(self,*args):
        self.username = str(args[0])
        output = "%s%s" % ("username: ", self.username)
        self._outlet(6, output)

    def _anything_3(self,*args):
        self.passw = str(args[0])
        output = "%s%s" % ("password: ", self.passw)
        self._outlet(6, output)

    def _anything_4(self,*args):
        self.service = str(args[0])
        output = "%s%s" % ("service: ", self.service)
        self._outlet(6, output)

    def float_5(self,f):
        self.port = int(f)
        output = "%s%s" % ("port: ", self.port)
        self._outlet(6, output)

    def float_6(self,f):
        secure = int(f)
        if secure == 0:
            self.secure = False
        elif secure == 1:
            self.secure = True
        output = "%s%s" % ("secure: ", self.secure)
        self._outlet(6, output)

    def _anything_7(self,*args):
        folder = []
        for arg in args:
            folder.append(str(arg))
        self.folder = ' '.join(folder)
        output = "%s%s" % ("folder: ", self.folder)
        self._outlet(6, output)

    def _anything_8(self,*args):
        tosearch = []
        for arg in args:
            tosearch.append(str(arg))
        self.search = ' '.join(tosearch)
        output = "%s%s" % ("search: ", self.search)
        self._outlet(6, output)

    def _anything_9(self,*args):
        self.field = str(args[0])
        output = "%s%s" % ("field: ", self.field)
        self._outlet(6, output)

    def float_10(self,f):
        self.howmany = int(f)
        output = "%s%s" % ("results: ", self.howmany)
        self._outlet(6, output)

