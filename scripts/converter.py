#    utils.py is part of Mediagrid by Luca Franceschini & Luca Carrubba.
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
    import os
    import glob
    import commands
    import sys
    import shutil
    from subprocess import Popen,PIPE
    import platform
    import re
except:
    print "ERROR: You need os, subprocess, platform Python Libraries"

try:
    import pyext
except:
    print "ERROR: This script must be loaded by the PD/Max pyext external"

class converter(pyext._class):
    
    # number of inlets and outlets
    _inlets=4
    _outlets=2

    # methods for all inlets
    outs = []
	
    firstarg = []

    in_path = 0
    out_path = 0
    ratio = 0
    name=0

    # constructor
    def __init__(self,*args):
	self._detach(1)
        print "Converter object loaded"
    def bang_1(self):
	 checksys = platform.system()
	 ratio=self.ratio
	 ffmpeg = "ffmpeg"
    	 if checksys == "Windows":
        	ffmpeg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ffmpeg.exe")
    	 elif checksys == "Darwin":
        	ffmpeg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ffmpeg")
	 filename = self.in_path
	 print filename
	 if file_type(filename):
	 	self.name= convertfile(filename, self.in_path, self.out_path, ratio, ffmpeg)
	 	

	 self._outlet(1, self.name)
	 self._outlet(2, "bang")

    
    def _anything_2(self,*args):
        self.in_path = os.path.abspath(str(args[0]))
	for root, subFolders, files in os.walk(self.in_path):
        	for cartella in subFolders:
            		self.rel_path = os.path.join(self.out_path,os.path.relpath(os.path.join(root,cartella),self.in_path))
            		if not os.path.isdir(self.rel_path):
                		os.mkdir(self.rel_path)
             			print 'dir create: %s' % self.rel_path
              			self.tot_dir = self.tot_dir + 1

    def _anything_3(self, *args):
	self.out_path = os.path.abspath(str(args[0]))
	if not os.path.isdir(self.out_path):
                print "Input directory is not valid"
                print "You must insert a valid directory"
	if not os.path.isdir(self.out_path):
        	os.mkdir(self.out_path)
        	print 'dir create: %s' % self.out_path
		self.tot_dir = self.tot_dir + 1

    def _anything_4(self, *args):
	self.ratio=str(args[0])





#this function return 1 if is a video file
def file_type(filename):
    import mimetypes
    type = mimetypes.guess_type(filename)[0]
    if type is None:
        return 0
    type = type.split("/")[0]
    if type == "video":
        return 1
    return 0

#convert the file
def convertfile(filename, in_path, out_path, ratio, ffmpeg):
    newfile = os.path.splitext(os.path.basename(in_path))[0]+".mov"
    newfile2 = os.path.join(out_path, newfile)
    print 'converting %s -> %s' % (filename, newfile2)
    if ratio:
        try:
            p = Popen([ffmpeg, "-i", filename, "-an", "-sameq", "-vcodec", "mjpeg", "-f", "mov", "-y", "-s", ratio, newfile2], stdout=PIPE, stderr=PIPE)
	    p.wait()
            if (p.returncode == 1):
                print "Error on FFMPEG thumb creation"
        except:
            print "No FFMPEG library?"
    else:
        try:
            p = Popen([ffmpeg, "-i", filename, "-an", "-sameq", "-vcodec", "mjpeg", "-f", "mov", "-y", newfile2], stdout=PIPE, stderr=PIPE)
            p.wait()
	    
            if (p.returncode == 1):
                print "Error on FFMPEG thumb creation"
        except:
            print "No FFMPEG library?" 
    return newfile2


