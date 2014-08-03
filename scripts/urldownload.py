#    urldownload.py is part of Qweb by Luca Franceschini & Luca Carrubba.
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
	import os, sys, urllib2, tempfile
except:
	print "ERROR: can't load some libraries"


class start(pyext._class):

    # number of inlets and outlets
    _inlets=3
    _outlets=3

    # constructor
    def __init__(self,*args):
        self._detach(1)
        print "urldownload object loaded"

    def _anything_1(self,*args):
        self.input = str(args[0])
        chunk_size = 8192
        response = urllib2.urlopen(self.input);
        total_size = response.info().getheader('Content-Length').strip()
        total_size = int(total_size)
        bytes_so_far = 0

        if hasattr(self, 'filename'):
            filename = self.filename
        else:
            filename = self.input.split('/')[-1]

        if hasattr(self, 'path'):
            filename = os.path.join(os.path.abspath(self.path), filename)
        else:
            filename = os.path.join(tempfile.gettempdir(), filename)
       
        f = open(filename, 'wb')

        while 1:
           chunk = response.read(chunk_size)
   
           f.write(chunk)

           bytes_so_far += len(chunk)
    
           if not chunk:
              break
    
           self.progress(bytes_so_far, chunk_size, total_size)

        f.close()
        self._outlet(1, filename)

    def _anything_2(self,*args):
        self.filename = str(args[0])
        output = "%s%s" % ("filename: ", self.filename)
        self._outlet(3, output)

    def _anything_3(self,*args):
        self.path = str(args[0])
        output = "%s%s" % ("path: ", self.path)
        self._outlet(3, output)

    def progress(self, bytes_so_far, chunk_size, total_size):
        progr_float = float(bytes_so_far) / total_size
        self._outlet(2, progr_float)
        percent = round(progr_float*100, 2)
        output = "Downloaded %d of %d bytes (%0.2f%%)" % (bytes_so_far, total_size, percent)
        self._outlet(3, output)

        if bytes_so_far >= total_size:
           self._outlet(3, "DONE")
