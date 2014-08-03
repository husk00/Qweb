#    flickr.py is part of Qweb by Luca Franceschini & Luca Carrubba.
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
	import os, sys, datetime, tempfile
except:
	print "ERROR: can't load some libraries"

try:
	from pattern.web import Flickr, extension, plaintext, encode_utf8
except:
	print "I'm loading pattern module from lib directory"
        MODULE_PATTERN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../lib/pattern")
        sys.path.append(MODULE_PATTERN)
        try:
	    from pattern.web import Flickr, extension, plaintext, encode_utf8
        except:
	    print "ERROR: can't load pattern library"

from Tkinter import *
import random


class start(pyext._class):

    # number of inlets and outlets
    _inlets=8
    _outlets=5

    # constructor
    def __init__(self,*args):
        self._detach(1)
        print "flickr object loaded"

    def _anything_1(self,*args):

        #default vars
        varstart=1
        varcount=10
        varsort='relevancy'
        varsize='medium'
        download=False
        outpath=tempfile.gettempdir()

        tosearch = []
        for arg in args:
            tosearch.append(str(arg))
        self.input = ' '.join(tosearch)

        if hasattr(self, 'start'):
            varstart = self.start
        if hasattr(self, 'count'):
            varcount = self.count
        if hasattr(self, 'sort'):
            varsort = self.sort
        if hasattr(self, 'size'):
            varsize = self.size
        if hasattr(self, 'download'):
            download = self.download
        if hasattr(self, 'outpath'):
            outpath = os.path.abspath(self.outpath)
        dbgmsg = "%s%d%s%d%s%s%s%s%s%s%s%s%s%s" % ("start:", varstart, " count:", varcount, " sort:", varsort, " size:", varsize, " search:", self.input, " download:", download, " output path:", outpath)
        self._outlet(5, dbgmsg)

        engine = Flickr(license=None)
        results = engine.search(self.input, start=varstart, count=varcount, sort=varsort, size=varsize, cached=False)

        if (download):
            now = datetime.datetime.now()
            timenow = "%s%s%s" % (self.input, "_", now.strftime('%Y%m%d-%H%M'))
            pathdir = os.path.join(outpath, timenow)
            if not os.path.isdir(pathdir):
                os.mkdir(pathdir)
                output = "%s%s" % ("created: ", str(pathdir))
                self._outlet(5, output)

        for img in results:
            author = encode_utf8(plaintext(img.author))
	    description = encode_utf8(img.description)
            url = encode_utf8(img.url)
            self._outlet(1, description)
            self._outlet(2, author)
            self._outlet(3, url)
            if (download):
                if url != "None":
                    data = img.download()
                    filename = img.url.rsplit("/",1)[1]
                    pathfile = os.path.join(pathdir, filename)
                    f = open(pathfile, "w")
                    f.write(data)
                    f.close()
                    output = "%s%s" % ("downloaded: ", str(pathfile))
                    self._outlet(5, output)

        if (download):
            self._outlet(4, str(pathdir))

    def float_2(self,f):
        self.start = int(f)
        output = "%s%d" % ("start: ", self.start)
        self._outlet(5, output)

    def float_3(self,f):
        self.count = int(f)
        output = "%s%d" % ("count: ", self.count)
        self._outlet(5, output)

    def float_4(self,f):
        sortype = int(f)
        if sortype == 0:
            self.sort = 'relevancy'
        elif sortype == 1:
            self.sort = 'latest'
        elif sortype == 2:
            self.sort = 'interesting'
        output = "%s%s" % ("sort: ", self.sort)
        self._outlet(5, output)

    def float_5(self,f):
        sizetype = int(f)
        if sizetype == 0:
            self.size = 'tiny'
        elif sizetype == 1:
            self.size = 'small'
        elif sizetype == 2:
            self.size = 'medium'
        elif sizetype == 3:
            self.size = 'large'
        output = "%s%s" % ("size: ", self.size)
        self._outlet(5, output)

    def float_6(self,f):
        download = int(f)
        if download == 0:
            self.download = False
        elif download == 1:
            self.download = True
        output = "%s%s" % ("download: ", self.download)
        self._outlet(5, output)

    def _anything_7(self,*args):
        self.outpath = str(args[0])
        output = "%s%s" % ("output path: ", self.outpath)
        self._outlet(5, output)

    def bang_8(self):
        self._priority(-3)
	# display the tcl/tk dialog
        app = flickr_gui(self)
        app.mainloop()

class flickr_gui(Frame):                                           
	"""This is the TK application class"""

	# Button pressed
	def say_hi(self):                                                    
		self.extcl._outlet(1,"hi there, everyone!")

	# Mouse motion over canvas
	def evfunc(self, ev):
		x = random.uniform(-3,3)
		y = random.uniform(-3,3)
		self.mcanv.move('group',x,y)	

	# Create interface stuff
	def createWidgets(self):                                             
		self.hi = Button(self)                                         
		self.hi["text"] = "Hi!"                                       
		self.hi["fg"]   = "red"                                       
		self.hi["command"] =  self.say_hi                                                                       
		self.hi.pack({"side": "left"})                                
                                                                    
		self.mcanv = Canvas(self)
		self.mcanv.pack({"side": "left"})
		self.mcanv.bind("<Motion>", self.evfunc)
		self.mcanv.create_rectangle(50,50,200,200)
		r = self.mcanv.create_rectangle(50,50,200,200)
		self.mcanv.addtag_withtag('group',r)

		for i in xrange(500):
			x = random.uniform(50,200)
			y = random.uniform(50,200)
			l = self.mcanv.create_line(x,y,x+1,y)
			self.mcanv.addtag_withtag('group',l)
                                                                    
	# Constructor
	def __init__(self,cl):
		self.extcl = cl
		Frame.__init__(self)
		self.pack()
		self.createWidgets()
		pass
