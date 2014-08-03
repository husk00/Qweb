#    videosearch.py is part of Qweb by Luca Franceschini & Luca Carrubba.
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
	import os, re, sys, platform, subprocess
except:
	print "ERROR: can't load some libraries"

#MODULE_YOUTUBE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../lib/youtubedl")
#sys.path.append(MODULE_YOUTUBE)
#try:
#        import youtubedl as youtubedl
#except:
#	print "ERROR: can't load youtubedl library"


class start(pyext._class):

    # number of inlets and outlets
    _inlets=3
    _outlets=7

    # constructor
    def __init__(self,*args):
        self._detach(1)
        print "videosearch object loaded"

    def _anything_1(self,*args):
        howmany = 3
        provider = "ytsearch"

        if hasattr(self, 'provider'):
            provider = self.provider
        if hasattr(self, 'count'):
            howmany = self.count

        tosearch = []
        for arg in args:
            tosearch.append(str(arg))
        self.input = ' '.join(tosearch)
        searchstring = "%s%d%s%s%s" % (provider, howmany, ":\"", self.input, "\"")

        youtubedl = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../lib/youtubedl/youtubedl.py")
        myos = platform.system()
        commandln = ["python", youtubedl, "-s", "--get-title", "--get-description", "--get-filename", "--get-format", "--get-thumbnail", "--get-url", searchstring]
        try:
                startupinfo = None
                if myos == "Windows":
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                p = subprocess.Popen(commandln, startupinfo=startupinfo, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                p.wait()
                if (p.returncode == 1):
                    for errline in p.stderr:
                        self._outlet(7,errline)
                        break
                else:
                    inletcount = 0
                    while True:
                        line = p.stdout.readline()
                        if line != '':
                            if inletcount < 6:
                                inletcount = inletcount +1
                            else:
                                inletcount = 1
                            self._outlet(inletcount,line.rstrip())
                        else:
                            break
                    for boh in p.stderr:
                        self._outlet(7,boh)
                        break
        except:
                self._outlet(7,"No youtubedl installed?")

    def float_2(self,f):
        self.count = int(f)
        output = "%s%d" % ("count: ", self.count)
        self._outlet(7, output)

    def float_3(self,f):
        provider = int(f)
        if provider == 0:
            self.provider = 'ytsearch'
        elif provider == 1:
            self.provider = 'gvsearch'
        elif provider == 2:
            self.provider = 'ybsearch'
        output = "%s%s" % ("provider: ", self.provider)
        self._outlet(7, output)
