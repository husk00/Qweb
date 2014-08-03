#### PATTERN | VECTOR ################################################################################
# -*- coding: utf-8 -*-
# Copyright (c) 2010 University of Antwerp, Belgium
# Author: Tom De Smedt <tom@organisms.be>
# License: BSD (see LICENSE.txt for details).
# http://www.clips.ua.ac.be/pages/pattern

######################################################################################################
# Vector space search, based on cosine similarity using tf-idf.
# Term frequency – inverse document frequency is a statistical measure used to evaluate 
# how important a word is to a document in a collection or corpus. 
# The importance increases proportionally to the number of times a word appears in the document 
# but is offset by the frequency of the word in the corpus. 
# Variations of the tf–idf weighting scheme are often used by search engines 
# as a central tool in scoring and ranking a document's relevance given a user query.

import os
import glob
import heapq
import codecs
import cPickle; BINARY=1
import stemmer; _stemmer=stemmer

from math      import pow, log
from time      import time
from random    import random, choice
from itertools import izip, chain
from bisect    import insort

try:
    MODULE = os.path.dirname(__file__)
except:
    MODULE = ""

try: from pattern.en.inflect import singularize, conjugate
except:
    try: 
        import sys; sys.path.insert(0, os.path.join(MODULE, ".."))
        from en.inflect import singularize, conjugate
    except:
        singularize = lambda w: w
        conjugate = lambda w,t: w

#--- STRING FUNCTIONS --------------------------------------------------------------------------------
            
def decode_utf8(string):
    """ Returns the given string as a unicode string (if possible).
    """
    if isinstance(string, str):
        try: 
            return string.decode("utf-8")
        except:
            return string
    return unicode(string)
    
def encode_utf8(string):
    """ Returns the given string as a Python byte string (if possible).
    """
    if isinstance(string, unicode):
        try: 
            return string.encode("utf-8")
        except:
            return string
    return str(string)
    
def lreplace(a, b, string):
    """ Replaces the head of the string.
    """
    if string.startswith(a): 
        return b + string[len(a):]
    return string
       
def rreplace(a, b, string):
    """ Replaces the tail of the string.
    """
    if string.endswith(a): 
        return string[:len(string)-len(a)] + b
    return string
    
def filename(path, map={"_":" "}):
    """ Returns the basename of the file at the given path, without the extension.
        For example: /users/tom/desktop/corpus/aesthetics.txt => aesthetics.
    """
    f = os.path.splitext(os.path.basename(path))[0]
    for k in map: 
        f = f.replace(k, map[k])
    return f
    
def shi(i, base="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"):
    """ Returns a short string hash for a given int.
    """
    s = []
    while i > 0:
        i, r = divmod(i, len(base))
        s.append(base[r])
    return "".join(reversed(s))

#--- LIST FUNCTIONS ----------------------------------------------------------------------------------

def shuffled(list):
    """ Yields a copy of the given list with the items in random order.
    """
    return sorted(list, key=lambda x: random())

def chunk(list, n):
    """ Yields n successive equal-sized chunks from the given list.
    """
    i = 0
    for m in xrange(n):
        j = i + len(list[m::n]) 
        yield list[i:j]
        i=j

#--- READ-ONLY DICTIONARY ----------------------------------------------------------------------------

class ReadOnlyError(Exception):
    pass

# Read-only dictionary, used for Document.terms and Document.vector.
# These can't be updated because it invalidates the cache.
class readonlydict(dict):
    @classmethod
    def fromkeys(self, k, default=None):
        d=readonlydict((k, default) for k in k); return d
    def __init__(self, *args, **kwargs):
        dict.__init__(self, *args, **kwargs)
    def __setitem__(self, k, v):
        raise ReadOnlyError
    def __delitem__(self, k):
        raise ReadOnlyError
    def pop(self, k, default=None):
        raise ReadOnlyError
    def popitem(self, kv):
        raise ReadOnlyError
    def clear(self):
        raise ReadOnlyError
    def update(self, kv):
        raise ReadOnlyError
    def setdefault(self, k, default=None):
        if k in self: 
            return self[k]
        raise ReadOnlyError

# Read-only list, used for Corpus.documents.
class readonlylist(list):
    def __init__(self, *args, **kwargs):
        list.__init__(self, *args, **kwargs)
    def __setitem__(self, i, v):
        raise ReadOnlyError
    def __delitem__(self, i):
        raise ReadOnlyError
    def append(self, v):
        raise ReadOnlyError
    def insert(self, i, v):
        raise ReadOnlyError
    def extend(self, v):
        raise ReadOnlyError
    def remove(self, v):
        raise ReadOnlyError
    def pop(self, i):
        raise ReadOnlyError

#### DOCUMENT ########################################################################################

#--- STOP WORDS --------------------------------------------------------------------------------------

stopwords = _stopwords = dict.fromkeys(
    open(os.path.join(MODULE, "stopwords.txt")).read().split(", "), True)

# The following words could also be meaningful nouns:
#for w in ["mine", "us", "will", "can", "may", "might"]:
#    stopwords.pop(w)

#--- WORD COUNT --------------------------------------------------------------------------------------

PUNCTUATION = "*#[]():;,.!?\n\r\t\f- "

def words(string, filter=lambda w: w.isalpha() and len(w)>1, punctuation=PUNCTUATION, **kwargs):
    """ Returns a list of words from the given string.
        Common punctuation marks are stripped from words.
    """
    if isinstance(string, unicode):
        string = string.replace(u"’", u"'")
    words = string.replace("\n", "\n ")
    words = (rreplace("'s", "", w.strip(punctuation)) for w in words.split(" "))
    words = [w for w in words if filter(w) is True]
    return words

PORTER, LEMMA = "porter", "lemma"
def stem(word, stemmer=PORTER, **kwargs):
    """ Returns the base form of the word when counting words in count().
        With stemmer=PORTER, the Porter2 stemming algorithm is used.
        With stemmer=LEMMA, either uses Word.lemma or inflect.singularize().
    """
    if stemmer is None:
        return word
    if stemmer == PORTER:
        return _stemmer.stem(decode_utf8(word).lower(), **kwargs)
    if stemmer == LEMMA:
        if word.__class__.__name__ == "Word":
            if word.lemma is not None:
                return word.lemma
            if word.pos == "NNS":
                return singularize(word.string.lower())
            if word.pos.startswith("VB"):
                return conjugate(word.string.lower(), "infinitive") or word
        return singularize(word)
    if type(stemmer).__name__ == "function":
        return stemmer(word)
    return word

def count(words=[], top=None, threshold=0, stemmer=None, exclude=[], stopwords=False, **kwargs):
    """ Returns a dictionary of (word, count)-items, in lowercase.
        Words in the exclude list and stop words are not counted.
        Words whose count falls below (or equals) the given threshold are excluded.
        Words that are not in the given top most counted are excluded.
    """
    # An optional dict-parameter can be used to specify a subclass of dict, 
    # e.g., count(words, dict=readonlydict) as used in Document.
    count = kwargs.get("dict", dict)()
    for word in words:
        if word.__class__.__name__ == "Word":
            w = word.string.lower()
        else:
            w = word.lower()
        if (stopwords or not w in _stopwords) and not w in exclude:
            if stemmer is not None:
                w = stem(w, stemmer, **kwargs)
            dict.__setitem__(count, w, (w in count) and count[w]+1 or 1)
    for k in count.keys():
        if count[k] <= threshold:
            dict.__delitem__(count, k)
    if top is not None:
        count = count.__class__(heapq.nlargest(top, count.iteritems(), key=lambda (k,v): v))
    return count

#--- DOCUMENT ----------------------------------------------------------------------------------------
# Document is a bag of words in which each word is a feature.
# Document is represented as a vector of weighted (TF-IDF) features.

__UID = 0
__SESSION = shi(int(time()*1000)) # Avoids collision with pickled documents.
def _uid():
    global __UID; __UID+=1; return __SESSION+"-"+str(__UID)

# Term relevancy weight:
TF, TFIDF, TF_IDF = "tf", "tf-idf", "tf-idf"

class Document(object):
    
    # Document(string="", filter, punctuation, top, threshold, stemmer, exclude, stopwords, name, type)
    def __init__(self, string="", **kwargs):
        """ A dictionary of (word, count)-items parsed from the string.
            Punctuation marks are stripped from the words.
            Stop words in the exclude list are excluded from the document.
            Only words whose count exceeds the threshold and who are in the top are included in the document.
        """
        kwargs.setdefault("threshold", 0)
        kwargs.setdefault("dict", readonlydict)
        # A string of words, map to read-only dict of (word, count)-items.
        if isinstance(string, basestring):
            w = words(string, **kwargs)
            w = count(w, **kwargs)
            v = None
        # A list of words, map to read-only dict of (word, count)-items.
        elif isinstance(string, (list, tuple)):
            w = string
            w = count(w, **kwargs)
            v = None
        # A dict of (word, count)-items, make read-only.
        elif isinstance(string, dict):
            w = string
            w = kwargs["dict"](w)
            v = None
        # A Vector of (word, weight)-items, copy as document vector.
        elif isinstance(string, Vector):
            w = string
            w = kwargs["dict"](w) # XXX term count is lost.
            v = Vector(w)
        # pattern.en.Sentence with Word objects, can use stemmer=LEMMA.
        elif string.__class__.__name__ == "Sentence":
            w = string.words
            w = count(w, **kwargs)
            v = None
        # pattern.en.Text with Sentence objects, can use stemmer=LEMMA.
        elif string.__class__.__name__ == "Text":
            w = []; [w.extend(sentence.words) for sentence in string]
            w = count(w, **kwargs)
            v = None
        else:
            raise TypeError, "document string is not str, unicode, list, Vector, Sentence or Text."
        self._id       = _uid()             # Document ID, used when comparing objects.
        self._name     = kwargs.get("name") # Name that describes the document content.
        self._type     = kwargs.get("type") # Type that describes the category or class of the document.
        self._terms    = w                  # Dictionary of (word, count)-items.
        self._count    = v                  # Total number of words (minus stop words).
        self._vector   = None               # Cached tf-idf vector.
        self._corpus   = None               # Corpus this document belongs to.

    @classmethod
    def open(Document, path, *args, **kwargs):
        """ Creates and returns a new document from the given text file path.
        """
        s = codecs.open(path, encoding=kwargs.get("encoding", "utf-8")).read()
        return Document(s, *args, **kwargs)
        
    @classmethod
    def load(Document, path):
        """ Returns a new Document from the given text file path.
            The text file assumed to be generated with Document.save(), 
            so no filtering and stemming will be carried out (=faster).
        """
        s = open(path, "rb").read()
        s = s.lstrip(codecs.BOM_UTF8)
        return Document(s, name=filename(path), stemmer=None, punctuation="", filter=lambda w:True, threshold=0)
    
    def save(self, path):
        """ Saves the terms in the document as a space-separated text file at the given path.
            The advantage is that terms no longer need to be filtered or stemmed in Document.load().
        """
        s = [[w]*n for w, n in self.terms.items()]
        s = [" ".join(w) for w in s]
        s = encode_utf8(" ".join(s))
        f = open(path, "wb")
        f.write(codecs.BOM_UTF8)
        f.write(s)
        f.close()

    def _get_corpus(self):
        return self._corpus
    def _set_corpus(self, corpus):
        self._vector = None
        self._corpus and self._corpus._update()
        self._corpus = corpus
        self._corpus and self._corpus._update()
        
    corpus = property(_get_corpus, _set_corpus)

    @property
    def id(self):
        return self._id

    @property
    def name(self):
        return self._name
        
    @property
    def type(self):
        return self._type
    
    @property
    def terms(self):
        return self._terms
    
    words = terms
    
    @property
    def features(self):
        return self._terms.keys()
    
    @property
    def count(self):
        return self.__len__()

    def __len__(self):
        # Yields the number of words (excluding stop words) in the document.
        # Cache the word count so we can reuse it when calculating tf.
        if not self._count: self._count = sum(self.terms.values())
        return self._count
    def __iter__(self):
        return iter(self.terms)
    def __contains__(self, word):
        return word in self.terms
    def __getitem__(self, word):
        return self.terms.__getitem__(word)
    def get(self, word, default=None):
        return self.terms.get(word, default)
    
    def term_frequency(self, word):
        """ Returns the term frequency of a word in the document.
            tf = number of occurences of the word / number of words in document.
            The more occurences of the word, the higher its tf weight.
        """
        return float(self.terms.get(word, 0)) / (len(self) or 1)
        
    tf = term_frequency
    
    def term_frequency_inverse_document_frequency(self, word, weight=TFIDF):
        """ Returns the word relevancy as tf*idf.
            The relevancy is a measure of how frequent the word occurs in the document,
            compared to its frequency in other documents in the corpus.
            If the document is not part of a corpus, returns tf weight.
        """
        w = self.tf(word)
        if weight == TFIDF:
            # Use tf if no corpus, or idf==None (happens when the word is not in the corpus).
            w *= self.corpus and self.corpus.idf(word) or 1
        return w
        
    tf_idf = tfidf = term_frequency_inverse_document_frequency
    
    @property
    def vector(self):
        """ Yields a dictionary of (word, relevancy)-items from the document, based on tf-idf.
        """
        if not self._vector:
            # Corpus.weight (TFIDF or TF) determines how the weights will be calculated.
            f = getattr(self.corpus, "weight", TFIDF) == TFIDF and self.tf_idf or self.tf
            # See the Vector class below = a dict with extra functionality (copy, norm).
            self._vector = Vector(((w, f(w)) for w in self.terms))
        return self._vector

    def keywords(self, top=10, normalized=True):
        """ Returns a sorted list of (relevancy, word)-tuples that are top keywords in the document.
            With normalized=True, weights are normalized between 0.0 and 1.0 (their sum will be 1.0).
        """
        n = normalized and sum(self.vector.itervalues()) or 1.0
        v = ((f/n, w) for w, f in self.vector.iteritems())
        v = heapq.nsmallest(top, v, key=lambda v: (-v[0],v[1]))
        return v
    
    def cosine_similarity(self, document):
        """ Returns the similarity between the two documents as a number between 0.0-1.0.
            If both documents are in the same corpus the calculations are cached for reuse.
        """
        if self.corpus: 
            return self.corpus.cosine_similarity(self, document)
        if document.corpus:
            return document.corpus.cosine_similarity(self, document)
        # Use dict copies to ensure that the values are in the same order:
        return cosine_similarity(self.vector(self).values(), self.vector(document).values())
            
    similarity = cosine_similarity
    
    def copy(self):
        d = Document(name=self.name, type=self.type); dict.update(d.terms, self.terms); return d
    
    def __eq__(self, document):
        return isinstance(document, Document) and self.id == document.id
    def __ne__(self, document):
        return not self.__eq__(document)
    
    def __repr__(self):
        return "Document(id=%s%s)" % (
            repr(self._id), self.name and ", name=%s" % repr(self.name) or "")

#--- VECTOR ------------------------------------------------------------------------------------------
# Document vector, using a sparse representation (i.e., dictionary with only features > 0).
# Sparse representation is fast, usually even faster than LSA,
# since LSA creates a dense vector with non-zero values.
# Average feature length: 
# sum(len(d.vector) for d in corpus.documents) / float(len(corpus))

class WeightError(Exception):
    pass

class Vector(readonlydict):
    
    def __init__(self, *args, **kwargs):
        """ Vector is a dictionary of (word, weight)-items based on the terms in a Document.
        """
        self.weight = kwargs.pop("weight", TFIDF) # Vector weights based on tf or tf-idf?
        self._norm  = None
        readonlydict.__init__(self, *args, **kwargs)
    
    @property
    def features(self):
        return self.keys()
    
    @property
    def l2_norm(self):
        """ Yields the Frobenius matrix norm.
            n = the square root of the sum of the absolute squares of the values.
            The matrix norm is used to normalize (0.0-1.0) cosine similarity between documents.
        """
        if not self._norm: self._norm = l2_norm(self.itervalues())
        return self._norm
        
    norm = frobenius_norm = l2_norm
    
    def copy(self):
        return Vector(self, weight=self.weight)

    def __call__(self, vector={}):
        if isinstance(vector, (Document, Corpus)):
            vector = vector.vector
        if isinstance(vector, Vector) and self.weight != vector.weight:
            raise WeightError, "mixing %s vector with %s vector" % (self.weight, vector.weight)
        # Return a copy of the vector, updated with values from the other vector.
        # Only keys that appear in this vector will be updated (i.e. no new keys are added).
        V = self.copy(); dict.update(V, ((k,v) for k,v in vector.iteritems() if k in V)); return V

# These functions are useful if you work with a bare matrix instead of Document and Corpus.
# Given vectors must be lists of values (not iterators).
    
def tf_idf(vectors):
    for i in range(len(vectors[0])):
        idf.append(log(len(vectors) / (sum(1.0 for v in vectors if v[i]) or 1)))
    return [[v[i] * idf[i] for i in range(len(v))] for v in vectors]

def cosine_similarity(vector1, vector2):
    return sum(a*b for a,b in izip(vector1, vector2)) / (l2_norm(vector1) * l2_norm(vector2) or 1)

def l2_norm(vector):
    return sum(x**2 for x in vector) ** 0.5

#### CORPUS ##########################################################################################

#--- CORPUS ------------------------------------------------------------------------------------------

# Export formats:
ORANGE, WEKA = "orange", "weka"

# LSA reduction methods:
NORM, TOP300 = "norm", "top300"

# Feature selection methods:
KLD = "kullback-leibler"

# Clustering methods:
KMEANS, HIERARCHICAL, ALL = "k-means", "hierarchical", "all"

class Corpus(object):
    
    def __init__(self, documents=[], weight=TFIDF):
        """ A corpus is a collection of documents,
            where each document is a bag of (word, count)-items.
            Documents can be compared for similarity.
        """
        self.description = ""             # Description of the dataset, author e-mail, etc.
        self._documents  = readonlylist() # List of documents (read-only).
        self._index      = {}             # Document.name => Document
        self._df         = {}             # Cache of document frequency per word.
        self._similarity = {}             # Cache of ((D1.id,D2.id), weight)-items (cosine similarity).
        self._divergence = {}             # Cache of Kullback-leibler divergence per (word1, word2).
        self._vector     = None           # Cache of corpus vector with all the words in the corpus.
        self._lsa        = None           # LSA matrix with reduced dimensionality.
        self._weight     = weight         # Weight used in Document.vector (TF-IDF or TF).
        self._update()
        self.extend(documents)
    
    @property
    def documents(self):
        return self._documents

    @property
    def terms(self):
        return self.vector.keys()
        
    features = words = terms

    def _get_lsa(self):
        return self._lsa
    def _set_lsa(self, v=None):
        self._lsa = v
        self._update()
        
    lsa = property(_get_lsa, _set_lsa)

    def _get_weight(self):
        return self._weight
    def _set_weight(self, w):
        self._weight = w
        self._update() # Clear the cache.
        
    weight = property(_get_weight, _set_weight)
    
    @classmethod
    def build(Corpus, path, *args, **kwargs):
        """ Builds the corpus from a folder of text documents (e.g. path="folder/*.txt").
            Each file is split into words and the words are counted.
        """
        documents = []
        for f in glob.glob(path):
            kwargs["name"] = filename(f)
            documents.append(Document.open(f, *args, **kwargs))
        return Corpus(documents)
    
    @classmethod
    def load(Corpus, path):
        """ Loads the corpus from a pickle file created with Corpus.save().
        """
        return cPickle.load(open(path))
        
    def save(self, path, update=False):
        """ Saves the corpus as a pickle file at the given path.
            It can be loaded with Corpus.load().
            This is faster because the words in the documents do not need to be stemmed again,
            and cached vectors and similarities are stored
        """
        if update:
            for d1 in self.documents:
                for d2 in self.documents:
                    self.cosine_similarity(d1, d2) # Update the entire cache before saving.
        for id1, id2 in self._similarity.keys():
            if id1 not in self._index \
            or id2 not in self._index:
                self._similarity.pop((id1, id2))   # Remove Corpus.search() query cache.
        cPickle.dump(self, open(path, "w"), BINARY)
        
    def export(self, path, format=ORANGE, **kwargs):
        """ Exports the corpus as a file for other machine learning applications,
            e.g., Orange or Weka which both have a GUI and are faster.
        """
        # Note: the Document.vector space is exported without cache or LSA concept space.
        keys = sorted(self.vector.keys())
        s = []
        # Orange tab format:
        if format == ORANGE:
            s.append("\t".join(keys + ["m#name", "c#type"]))
            for document in self.documents:
                v = document.vector
                v = [v.get(k,0) for k in keys]
                v = "\t".join(x==0 and "0" or "%.4f" % x for x in v)
                v = "%s\t%s\t%s" % (v, document.name or "", document.type or "")
                s.append(v)
        # Weka ARFF format:
        if format == WEKA:
            s.append("@RELATION %s" % kwargs.get("name", hash(self)))
            s.append("\n".join("@ATTRIBUTE %s NUMERIC" % k for k in keys))
            s.append("@ATTRIBUTE class {%s}" % ",".join(set(d.type for d in self.documents)))
            s.append("@DATA")
            for document in self.documents:
                v = document.vector
                v = [v.get(k,0) for k in keys]
                v = ",".join(x==0 and "0" or "%.4f" % x for x in v)
                v = "%s,%s" % (v, document.type or "")
                s.append(v)
        s = "\n".join(s)
        f = open(path, "w")
        f.write(codecs.BOM_UTF8)
        f.write(encode_utf8(s))
        f.close()
    
    def _update(self):
        # Ensures that all document relevancy vectors are recalculated
        # when a document is added or deleted in the corpus (= new words or less words).
        self._df = {}
        self._similarity = {}
        self._divergence = {}
        self._vector = None
        self._lsa = None
        for document in self.documents:
            document._vector = None
    
    def __len__(self):
        return len(self.documents)
    def __iter__(self):
        return iter(self.documents)
    def __getitem__(self, i):
        return self.documents.__getitem__(i)
    def __delitem__(self, i):
        d = list.pop(self.documents, i)
        d._corpus = None
        self._index.pop(d.name, None)
        self._update()
    def clear(self):
        self._documents = readonlylist()
        self._update()

    def append(self, document):
        """ Appends the given Document to the corpus, setting the corpus as its parent.
            The corpus is updated, meaning that the cache of vectors and similarities is cleared
            (relevancy and similarity weights will be different now that there is a new document).
        """
        document._corpus = self
        if document.name is not None:
            self._index[document.name] = document
        list.append(self.documents, document)
        self._update()
        
    def extend(self, documents):
        for document in documents:
            document._corpus = self
            if document.name is not None:
                self._index[document.name] = document
        list.extend(self.documents, documents)
        self._update()
        
    def remove(self, document):
        self.__delitem__(self.documents.index(document))
        
    def document(self, name):
        # This assumes document names are unique.
        if name in self._index:
            return self._index[name]
        if isinstance(name, int):
            return self.documents[name]
        
    def document_frequency(self, word):
        """ Returns the document frequency of a word.
            Returns 0 if there are no documents in the corpus (e.g. no word frequency).
            df = number of documents containing the word / number of documents.
            The more occurences of the word across the corpus, the higher its df weight.
        """
        if len(self.documents) == 0:
            return 0        
        if len(self._df) == 0:
            # Caching document frequency for each word gives a 300x performance boost
            # (calculate all of them once). Drawback: if you need TF-IDF for just one document.
            for d in self.documents:
                for w in d.terms:
                    self._df[w] = (w in self._df) and self._df[w]+1 or 1
            for w, f in self._df.iteritems():
                self._df[w] /= float(len(self.documents))
        return self._df[word]
        
    df = document_frequency
    
    def inverse_document_frequency(self, word):
        """ Returns the inverse document frequency of a word.
            Returns None if the word is not in the corpus, or if there are no documents in the corpus.
            idf = log(1/df)
            The more occurences of the word, the lower its idf weight (log() makes it grow slowly).
        """
        df = self.df(word)
        return df != 0 and log(1.0/df) or None
        
    idf = inverse_document_frequency

    @property
    def vector(self):
        """ Returns a dictionary of (word, 0)-items from the corpus.
            It includes all words from all documents (i.e. it is the dimension of the vector space).
            If a document is given, sets the document word relevancy values in the vector.
        """
        # Note: 
        # - Corpus.vector is the dictionary of all (word, 0)-items.
        # - Corpus.vector(document) returns a copy with the document's word relevancy values in it.
        # - This is the full document vector, opposed to the sparse Document.vector.
        # Words in a document that are not in the corpus vector are ignored
        # (e.g. the document was not in the corpus, this can be the case in Corpus.search() for example).
        # See Vector.__call__() why this is possible.
        if not self._vector: 
            self._vector = Vector((w,0) for w in chain(*(d.terms for d in self.documents)))
        return self._vector

    @property
    def vectors(self):
        return [d.vector for d in self.documents]

    @property
    def density(self):
        return float(sum(len(d.terms) for d in self.documents)) / len(self.vector)**2

    # Following methods rely on Document.vector:
    # cosine similarity, nearest neighbors, search, clustering, latent semantic analysis, divergence.
    
    def cosine_similarity(self, document1, document2):
        """ Returns the similarity between two documents in the corpus as a number between 0.0-1.0.
            The weight is based on the document relevancy vectors (i.e. tf-idf of words in the text).
            cos = dot(v1,v2) / (norm(v1) * norm(v2))
        """
        # If we already calculated the similarity between the given documents,
        # it is available in cache for reuse.
        id1 = document1.id
        id2 = document2.id
        if (id1,id2) in self._similarity: return self._similarity[(id1,id2)]
        if (id2,id1) in self._similarity: return self._similarity[(id2,id1)]
        # Calculate the matrix multiplication of the document vectors.
        #v1 = self.vector(document1)
        #v2 = self.vector(document2)
        #s = cosine_similarity(v1.itervalues(), v2.itervalues()) / (v1.norm * v2.norm or 1)
        if not getattr(self, "lsa", None):
            # This is exponentially faster for sparse vectors:
            v1 = document1.vector
            v2 = document2.vector
            s = sum(v1.get(w,0) * f for w, f in v2.iteritems()) / (v1.norm * v2.norm or 1)
        else:
            # Using LSA concept space:
            v1 = id1 in self.lsa and self.lsa[id1] or self._lsa.transform(document1)
            v2 = id2 in self.lsa and self.lsa[id2] or self._lsa.transform(document2)
            s = sum(a*b for a,b in izip(v1.itervalues(), v2.itervalues())) / (v1.norm * v2.norm or 1)
        # Cache the similarity weight for reuse.
        self._similarity[(id1,id2)] = s
        return s
        
    similarity = cosine_similarity
    
    def nearest_neighbors(self, document, top=10):
        """ Returns a list of (weight, document)-tuples in the corpus, 
            sorted by similarity to the given document.
        """
        v = ((self.cosine_similarity(document, d), d) for d in self.documents)
        # Filter the input document from the matches.
        # Filter documents that scored 0 and return the top.
        v = [(w, d) for w, d in v if w > 0 and d.id != document.id]
        v = heapq.nsmallest(top, v, key=lambda v: (-v[0], v[1]))
        return v
        
    similar = related = neighbors = nn = nearest_neighbors
        
    def vector_space_search(self, words=[], **kwargs):
        """ Returns related documents from the corpus, as a list of (weight, document)-tuples.
            The given words can be a string (one word), a list or tuple of words, or a Document.
        """
        top = kwargs.pop("top", 10)
        if not isinstance(words, (list, tuple)):
            words = [words]
        if not isinstance(words, Document):
            kwargs.setdefault("threshold", 0) # Same stemmer as other documents should be given.
            words = Document(" ".join(words), **kwargs)
        words._corpus = self # So we can calculate tf-idf.
        # Documents that are not in the corpus consisting only of words that are not in the corpus
        # have no related documents in the corpus.
        if len([True for w in words if w in self.vector]) == 0:
            return []
        return self.nearest_neighbors(words, top)
        
    search = vector_space_search
    
    def distance(self, document1, document2, *args, **kwargs):
        """ Returns the distance (COSINE, EUCLIDEAN, ...) between two document vectors (0.0-1.0).
        """
        return distance(document1.vector, document2.vector, *args, **kwargs)
    
    def cluster(self, documents=ALL, method=KMEANS, **kwargs):
        """ Clustering is an unsupervised machine learning method for grouping similar documents.
            For k-means clustering, returns a list of k clusters (each is a list of documents).
            For hierarchical clustering, returns a list of documents and Cluster objects.
            A Cluster is a list of documents and other clusters, with a Cluster.flatten() method.
        """
        if documents == ALL:
            documents = self.documents
        if not getattr(self, "lsa", None):
            # Using document vectors:
            vectors, keys = [d.vector for d in documents], self.vector.keys()
        else:
            # Using LSA concept space:
            vectors, keys = [self.lsa[d.id] for d in documents], range(len(self.lsa))
        # Create a dictionary of vector.id => Document.
        # We'll need it to map the clustered vectors back to the actual documents.
        map = dict((id(v), documents[i]) for i, v in enumerate(vectors))
        kw = kwargs.pop
        if method in (KMEANS, "kmeans"):
            # def cluster(self, method=KMEANS, k=10, iterations=10)
            clusters = k_means(vectors, kw("k", 10), kw("iterations", 10), keys=keys, **kwargs)
            clusters = [[map[id(v)] for v in cluster] for cluster in clusters]
        if method == HIERARCHICAL:
            # def cluster(self, method=HIERARCHICAL, k=1, iterations=1000)
            clusters = hierarchical(vectors, kw("k", 1), kw("iterations", 1000), keys=keys, **kwargs)
            clusters.traverse(visit=lambda cluster: \
                [cluster.__setitem__(i, map[id(v)]) for i, v in enumerate(cluster) if not isinstance(v, Cluster)])
        return clusters

    def latent_semantic_analysis(self, dimensions=NORM):
        """ Creates LSA concept vectors by reducing dimensions.
            The concept vectors are then used in Corpus.cosine_similarity() and Corpus.cluster().
            The reduction can be undone by setting Corpus.lsa=False.
        """
        self._lsa = LSA(self, k=dimensions)
        self._similarity = {}
        
    reduce = latent_semantic_analysis

    def kullback_leibler_divergence(self, word1, word2, _vectors=[], _map={}):
        """ Returns the difference between two given features (i.e. words from Corpus.terms),
            on average over all document vectors, using symmetric Kullback-Leibler divergence.
            Higher values represent more distinct features.
        """
        if not (word1, word2) in self._divergence:
            kl1 = 0
            kl2 = 0
            # It is not log() that is "slow", but the document.vector getter and dict.__contains__().
            # If you use KLD in a loop, collect the vectors once and pass them to _vectors (2x faster),
            # or pass a (word, vectors-that-contain-word) dictionary to _map (7x faster).
            for v in _map.get(word1) or _vectors or (d.vector for d in self.documents):
                if word1 in v:
                    kl1 += v[word1] * (log(v[word1], 2) - log(v.get(word2, 0.000001), 2))
            for v in _map.get(word2) or _vectors or (d.vector for d in self.documents):
                if word2 in v:
                    kl2 += v[word2] * (log(v[word2], 2) - log(v.get(word1, 0.000001), 2))
            # Cache the calculations for reuse.
            # The measurement is symmetric, so we also know KL(word2, word1).
            self._divergence[(word1, word2)] = \
            self._divergence[(word2, word1)] = (kl1 + kl2) / 2 
        return self._divergence[(word1, word2)]
    
    relative_entropy = kl = kld = kullback_leibler_divergence
    
    def feature_selection(self, top=100, method=KLD, verbose=False):
        """ Returns the top most distinct (or "original") features (terms), using Kullback-Leibler divergence.
            This is a subset of Corpus.terms that can be used to build a Classifier
            that is faster (less features = less matrix columns) but quite efficient.
        """
        # The subset will usually have less recall, because there are less features.
        # Calculating KLD takes some time, but the results are cached and saved with Corpus.save().
        v = [d.vector for d in self.documents]
        m = dict((w, filter(lambda v: w in v, v)) for w in self.terms)
        D = {}
        for i, w1 in enumerate(self.terms):
            for j, w2 in enumerate(self.terms[i+1:]):
                d = self.kullback_leibler_divergence(w1, w2, _vectors=v, _map=m)
                D[w1] = w1 in D and D[w1]+d or d
                D[w2] = w2 in D and D[w2]+d or d
            if verbose:
                # IG 80.0% (550/700)
                print "KLD " + ("%.1f"%(float(i) / len(self.terms) * 100)).rjust(4) + "% " \
                             + "(%s/%s)" % (i+1, len(self.terms))
        subset = sorted(((d, w) for w, d in D.iteritems()), reverse=True)
        subset = [w for d, w in subset[:top]]
        return subset
        
    def filter(self, features=[]):
        """ Returns a new Corpus with documents only containing the given list of words,
            for example a subset returned from Corpus.feature_selection(). 
        """
        features = dict.fromkeys(features, True)
        corpus = Corpus(weight=self.weight)
        corpus.extend([
            Document(dict((w, f) for w, f in d.terms.iteritems() if w in features),
                name = d.name,
                type = d.type) for d in self.documents])
        return corpus

#### LATENT SEMANTIC ANALYSIS ########################################################################

class LSA:
    
    def __init__(self, corpus, k=NORM):
        """ Latent Semantic Analysis is a statistical machine learning method 
            based on singular value decomposition (SVD).
            Related terms in the corpus are grouped into "concepts".
            Documents then get a concept vector that is an approximation of the original vector,
            but with reduced dimensionality so that cosine similarity and clustering run faster.
        """
        # http://en.wikipedia.org/wiki/Latent_semantic_analysis
        # http://blog.josephwilk.net/projects/latent-semantic-analysis-in-python.html
        import numpy
        matrix = [corpus.vector(d).values() for d in corpus.documents]
        matrix = numpy.array(matrix)
        # Singular value decomposition, where u * sigma * vt = svd(matrix).
        # Sigma is the diagonal matrix of singular values,
        # u has document rows and concept columns, vt has concept rows and term columns.
        u, sigma, vt = numpy.linalg.svd(matrix, full_matrices=False)
        # Delete the smallest coefficients in the diagonal matrix (i.e., at the end of the list).
        # The difficulty and weakness of LSA is knowing how many dimensions to reduce
        # (generally L2-norm is used).
        if k == TOP300:
            k = len(sigma)-300
        if k == NORM:
            k = int(round(numpy.linalg.norm(sigma)))
        if type(k).__name__ == "function":
            k = int(k(sigma))
        #print numpy.dot(u, numpy.dot(numpy.diag(sigma), vt))
        # Apply dimension reduction.   
        assert k < len(corpus.documents), \
            "can't delete more dimensions than there are documents"
        tail = lambda list, i: range(len(list)-i, len(list))
        u, sigma, vt = (
            numpy.delete(u, tail(u[0], k), axis=1),
            numpy.delete(sigma, tail(sigma, k), axis=0),
            numpy.delete(vt, tail(vt, k), axis=0)
        )
        # Store as Python dict and lists so we can cPickle it.
        self.corpus = corpus
        self._terms = dict(enumerate(corpus.vector().keys())) # Vt-index => word.
        self.u, self.sigma, self.vt = (
            dict((d.id, Vector((i, float(x)) for i, x in enumerate(v))) for d, v in izip(corpus, u)),
            list(sigma),
            [[float(x) for x in v] for v in vt]
        )
    
    @property
    def terms(self):
        # Yields a list of all words, identical to LSA.corpus.vector.keys()
        return self._terms.values()
        
    features = terms

    @property
    def concepts(self):
        # Yields a list of all concepts, each a dictionary of (word, weight)-items.
        return [dict((self._terms[i], w) for i,w in enumerate(concept)) for concept in self.vt]
    
    @property
    def vectors(self):
        # Yields a dictionary of (Document.id, concepts),
        # where concepts is a dictionary of (concept_index, weight)-items.
        return self.u

    def __getitem__(self, id):
        return self.u[id]
    def __contains__(self, id):
        return id in self.u
    def __iter__(self):
        return iter(self.u)
    def __len__(self):
        return len(self.u)
        
    def transform(self, document):
        """ Given a document not in the corpus, returns a vector in LSA concept space.
        """
        if document.id in self.u:
            return self.u[document.id]
        if document.id in _lsa_transform_cache:
            return _lsa_transform_cache[document.id]
        import numpy
        v = self.corpus.vector(document)
        v = [v[self._terms[i]] for i in range(len(v))]
        v = numpy.dot(numpy.dot(numpy.linalg.inv(numpy.diag(self.sigma)), self.vt), v)
        v = _lsa_transform_cache[document.id] = Vector(enumerate(v))
        return v
        
# LSA cache for Corpus.search() shouldn't be stored with Corpus.save(),
# so it is a global variable instead of a property of the LSA class.
_lsa_transform_cache = {}

#def iter2array(iterator, typecode):
#    a = numpy.array([iterator.next()], typecode)
#    shape0 = a.shape[1:]
#    for (i, item) in enumerate(iterator):
#        a.resize((i+2,) + shape0)
#        a[i+1] = item
#    return a

#def filter(matrix, min=0):
#    columns = numpy.max(matrix, axis=0)
#    columns = [i for i, v in enumerate(columns) if v <= min] # Indices of removed columns.
#    matrix = numpy.delete(matrix, columns, axis=1)
#    return matrix, columns

#### CLUSTERING ######################################################################################
# Clustering assigns vectors to subsets based on a distance measure, 
# which determines how "similar" two vectors are.
# For example, for (x,y) coordinates in 2D we could use Euclidean distance ("as the crow flies");
# for document vectors we could use cosine similarity.

def features(vectors):
    """ Returns a set of unique keys from all the given Vectors.
    """
    return set(k for k in chain(*vectors))

def mean(iterator, length):
    """ Returns the arithmetic mean of the values in the given iterator.
    """
    return sum(iterator) / (length or 1)

def centroid(vectors, keys=[]):
    """ Returns the center of the list of vectors
        (e.g., the geometric center of a list of (x,y)-coordinates forming a polygon).
        Since vectors are sparse, the list of all keys (=Corpus.vector) must be given.
    """
    v = ((k, mean((v.get(k, 0) for v in vectors), len(vectors))) for k in keys)
    v = Vector((k, x) for k, x in v if x != 0)
    return v

COSINE, EUCLIDEAN, MANHATTAN, HAMMING = \
    "cosine", "euclidean", "manhattan", "hamming"
    
def distance(v1, v2, method=COSINE):
    """ Returns the distance between two vectors.
    """
    if method == COSINE:
        return 1 - sum(v1.get(w,0) * f for w, f in v2.iteritems()) / (v1.norm * v2.norm or 1)
    if method == EUCLIDEAN: # Squared distance is 1.5x faster.
        return sum((v1.get(w,0) - v2.get(w,0))**2 for w in set(chain(v1, v2)))
    if method == MANHATTAN:
        return sum(abs(v1.get(w,0) - v2.get(w,0)) for w in set(chain(v1, v2)))
    if method == HAMMING:
        d = sum(not (w in v1 and w in v2 and v1[w] == v2[w]) for w in set(chain(v1, v2))) 
        d = d / float(max(len(v1), len(v2)))
        return d
    if isinstance(method, type(distance)):
        # Given method is a function of the form: distance(v1, v2) => float.
        return method(v1, v2)

_distance = distance

#--- K-MEANS ----------------------------------------------------------------------------------------
# Fast, no guarantee of convergence or optimal solution (random starting clusters).
# 3000 vectors with 100 features (LSA, density 1.0):  5 minutes with k=100 (20 iterations).
# 3000 vectors with 200 features (LSA, density 1.0): 13 minutes with k=100 (20 iterations).

# Initialization methods:
RANDOM, KMPP = "random", "kmeans++"

def k_means(vectors, k, iterations=10, distance=COSINE, **kwargs):
    """ Returns a list of k clusters, 
        where each cluster is a list of similar vectors (Lloyd's algorithm).
        There is no guarantee of convergence or optimal solution.
    """
    init = kwargs.get("seed", kwargs.get("initialization", RANDOM))
    keys = kwargs.get("keys") or list(features(vectors))
    if k < 2: 
        return [[v for v in vectors]]
    if init == KMPP:
        clusters = kmpp(vectors, k)
    else:
        clusters = [[] for i in xrange(k)]
        for i, v in enumerate(sorted(vectors, key=lambda x: random())):
            # Randomly partition the vectors across k clusters.
            clusters[i%k].append(v)
    converged = False
    while not converged and iterations > 0 and k > 0:
        # Calculate the center of each cluster.
        centroids = [centroid(cluster, keys) for cluster in clusters]
        # Triangle inequality: one side is shorter than the sum of the two other sides.
        # We can exploit this to avoid costly distance() calls (up to 3x faster).
        p = 0.5 * kwargs.get("p", 0.8) # "Relaxed" triangle inequality (cosine distance is a semimetric) 0.25-0.5.
        D = {}
        for i in range(len(centroids)):
            for j in range(i, len(centroids)): # center1–center2 < center1–vector + vector–center2 ?
                D[(i,j)] = D[(j,i)] = p * _distance(centroids[i], centroids[j], method=distance)
        # For every vector in every cluster,
        # check if it is nearer to the center of another cluster (if so, assign it).
        # When visualized, this produces a Voronoi diagram.
        converged = True
        for i in xrange(len(clusters)):
            for v in clusters[i]:
                nearest, d1 = i, _distance(v, centroids[i], method=distance)
                for j in xrange(len(clusters)):
                    if D[(i,j)] < d1: # Triangle inequality (Elkan, 2003).
                        d2 = _distance(v, centroids[j], method=distance)
                        if d2 < d1:
                            nearest = j
                if nearest != i: # Other cluster is nearer.
                    clusters[nearest].append(clusters[i].pop(clusters[i].index(v)))
                    converged = False
        iterations -= 1; #print iterations
    return clusters
    
kmeans = k_means

def kmpp(vectors, k):
    """ The k-means++ initialization algorithm, with the advantage that:
        - it generates better clusterings than standard k-means (RANDOM) on virtually all data sets,
        - it runs faster than standard k-means on average,
        - it has a theoretical approximation guarantee.
    """
    # David Arthur, 2006, http://theory.stanford.edu/~sergei/slides/BATS-Means.pdf
    # Based on:
    # http://www.stanford.edu/~darthur/kmpp.zip
    # http://yongsun.me/2008/10/k-means-and-k-means-with-python
    # Choose one center at random.
    # Calculate the distance between each vector and the nearest center.
    centroids = [choice(vectors)]
    d = [distance(v, centroids [0]) for v in vectors]
    s = sum(d)
    for _ in range(k-1):
        # Choose a random number y between 0 and d1 + d2 + ... + dn.
        # Find vector i so that: d1 + d2 + ... + di >= y > d1 + d2 + ... + dj.
        # Perform a number of local tries so that y yields a small distance sum.
        i = 0
        for _ in range(int(2 + log(k))):
            y = rnd() * s
            for i1, v1 in enumerate(vectors):
                if y <= d[i1]: 
                    break
                y -= d[i1]
            s1 = sum(min(d[j], distance(v1, v2)) for j, v2 in enumerate(vectors))
            if s1 < s:
                s, i = s1, i1
        # Add vector i as a new center.
        # Repeat until we have chosen k centers.
        centroids.append(vectors[i])
        d = [min(d[i], distance(v, centroids[-1])) for i, v in enumerate(vectors)]
        s = sum(d)
    # Assign points to the nearest center.
    clusters = [[] for i in xrange(k)]
    for v1 in vectors:
        d = [distance(v1, v2) for v2 in centroids]
        clusters[d.index(min(d))].append(v1)
    return clusters

#--- HIERARCHICAL -----------------------------------------------------------------------------------
# Slow, optimal solution guaranteed in O(len(vectors)^3).
#  100 vectors with 6 features (density 1.0): 0.2 seconds.
# 1000 vectors with 6 features (density 1.0): 2 minutes.
# 3000 vectors with 6 features (density 1.0): 30 minutes.

class Cluster(list):
    
    def __init__(self, *args, **kwargs):
        list.__init__(self, *args, **kwargs)
    
    @property
    def depth(self):
        """ Yields the maximum depth of nested clusters.
            Cluster((1, Cluster((2, Cluster((3, 4)))))).depth => 2.
        """
        return max([0] + [1+n.depth for n in self if isinstance(n, Cluster)])
    
    def flatten(self, depth=1000):
        """ Flattens nested clusters to a list, down to the given depth.
            Cluster((1, Cluster((2, Cluster((3, 4)))))).flatten(1) => [1, 2, Cluster(3, 4)].
        """
        a = []
        for item in self:
            if isinstance(item, Cluster) and depth > 0:
                a.extend(item.flatten(depth-1))
            else:
                a.append(item)
        return a
    
    def traverse(self, visit=lambda cluster: None):
        """ Calls the visit() function on this and each nested cluster.
        """
        visit(self)
        for item in self:
            if isinstance(item, Cluster): 
                item.traverse(visit)

    def __repr__(self):
        return "Cluster(%s)" % list.__repr__(self)[1:-1]

def hierarchical(vectors, k=1, iterations=1000, distance=COSINE, **kwargs):
    """ Returns a Cluster containing k items (vectors or clusters with nested items).
        With k=1, the top-level cluster contains a single cluster.
    """
    keys = kwargs.get("keys", list(features(vectors)))
    clusters = Cluster((v for v in sorted(vectors, key=lambda x: random())))
    centroids = list(clusters)
    D = {}
    for _ in range(iterations):
        if len(clusters) <= max(k,1): 
            break
        nearest, d0 = None, None
        for i, v1 in enumerate(centroids):
            for j, v2 in enumerate(centroids[i+1:]):
                v12 = (id(v1), id(v2))
                if v12 not in D: # Cache distance calculations for reuse.
                    D[v12] = _distance(v1, v2, method=distance)
                d = D[v12]
                if d0 is None or d < d0:
                    nearest, d0 = (i, j+i+1), d
        # Pairs of nearest clusters are merged as we move up the hierarchy:
        i, j = nearest
        merged = Cluster((clusters[i], clusters[j]))
        clusters.pop(j); centroids.pop(j)
        clusters.pop(i); centroids.pop(i)
        clusters.append(merged)
        centroids.append(centroid(merged.flatten(), keys))
    del D
    return clusters

#k = hierarchical([(1,2),(3,4),(5,6),(7,8)], k=2)
#print k
#print k.depth

#### CLASSIFIER ######################################################################################

#--- CLASSIFIER BASE CLASS ---------------------------------------------------------------------------

class Classifier:

    def __init__(self):
        self._classes  = []
        self._features = []

    @property
    def features(self):
        return self._features
    @property
    def terms(self): 
        return self.features

    @property
    def classes(self):
        return self._classes
    @property
    def types(self):
        return self.classes
    
    @property
    def binary(self):
        return sorted(self.classes) in ([False,True], [0,1])

    def train(self, document, type):
        # Must be implemented in a subclass.
        pass
        
    def classify(self, document):
        # Must be implemented in a subclass.
        return None

    def _vector(self, document, type=None):
        """ Returns a (type, Vector)-tuple for the given document.
            If the document is part of a LSA-reduced corpus, returns the LSA concept vector.
            If the given type is None, returns document.type (if a Document is given).
        """
        if isinstance(document, Document):
            if type is None:
                type = document.type
            if document.corpus and document.corpus.lsa:
                return type, document.corpus.lsa[document.id] # LSA concept vector.
            return type, document.vector
        if isinstance(document, (list, tuple)):
            return type, Vector.fromkeys(document, 1.0)
        if isinstance(document, dict):
            return type, Vector(document)
        if isinstance(document, basestring):
            return type, Vector(count(words(document), stemmer=None, stopwords=True))
    
    @classmethod
    def test(self, corpus=[], d=0.65, folds=1, **kwargs):
        """ Returns an (accuracy, precision, recall, F-score)-tuple for the given corpus.
            The corpus is a list of documents or (wordlist, type)-tuples.
            2/3 of the data will be used as training material and tested against the other 1/3.
            With folds > 1, K-fold cross-validation is performed.
            For example: in 10-fold cross-validation ten tests are performed,
            each using a different 1/10 of the corpus as testing data.
            For non-binary classifiers, precision, recall and F-score are None.
        """
        corpus  = [isinstance(x, Document) and (x, x.type) or x for x in corpus]
        corpus  = shuffled(corpus) # Avoid a list sorted by type (because we take successive folds).
        classes = set(type for document, type in corpus)
        binary  = len(classes) == 2 and sorted(classes) in ([False,True], [0,1])
        m = [0,0,0,0] # accuracy | precision | recall | F1-score.
        K = max(folds, 1)
        for k in range(K):
            classifier = self(**kwargs)
            t = len(corpus) / float(K) # Documents per fold.
            i = int(round(k * t))      # Corpus start index.
            j = int(round(k * t + t))  # Corpus stop index.
            if K == 1:
                i = int(len(corpus) * d)
                j = int(len(corpus))
            for document, type in corpus[:i] + corpus[j:]:
                # Train with 9/10 of the corpus, using 1/10 fold for testing.
                classifier.train(document, type)
            TP = TN = FP = FN = 0
            if not binary:
                # If the classifier predicts classes other than True/False,
                # we can only measure accuracy.
                for document, type in corpus[i:j]:
                    if classifier.classify(document) == type:
                        TP += 1
                m[0] += TP / float(j-i)
            else:
                # For binary classifiers, calculate the confusion matrix
                # to measure precision and recall.
                for document, b1 in corpus[i:j]:
                    b2 = classifier.classify(document)
                    if b1 and b2:
                        TP += 1 # true positive
                    elif not b1 and not b2:
                        TN += 1 # true negative
                    elif not b1 and b2:
                        FP += 1 # false positive (type I error)
                    elif b1 and not b2:
                        FN += 1 # false negative (type II error)
                m[0] += float(TP+TN) / ((TP+TN+FP+FN) or 1)
                m[1] += float(TP) / ((TP+FP) or 1)
                m[2] += float(TP) / ((TP+FN) or 1)
        m = [v/K for v in m]
        m[3] = binary and 2 * m[1] * m[2] / ((m[1] + m[2]) or 1) or 0 # F1-score.
        return binary and tuple(m) or (m[0], None, None, None)

    @classmethod
    def k_fold_cross_validation(self, corpus=[], k=10, **kwargs):
        return self.test(corpus, kwargs.pop(d,0.65), k, kwargs)
    
    crossvalidate = cross_validate = k_fold_cross_validation

    def save(self, path):
        cPickle.dump(self, open(path, "w"), BINARY)

    @classmethod
    def load(self, path):
        return cPickle.load(open(path))

#--- NAIVE BAYES CLASSIFIER --------------------------------------------------------------------------
# Based on: Magnus Lie Hetland, http://hetland.org/coding/python/nbayes.py

# We can't include these in the NaiveBayes class description,
# because you can't pickle functions:
# NBid1: store word index, used with aligned=True
# NBid1: ignore word index, used with aligned=False.
NBid1 = lambda type, v, i: (type, v, i)
NBid2 = lambda type, v, i: (type, v, 1)

class NaiveBayes(Classifier):
    
    def __init__(self, aligned=False):
        """ Naive Bayes is a simple supervised learning method for text classification.
            For example: if we have a set of documents of movie reviews (training data),
            and we know the star rating of each document, 
            we can predict the star rating for other movie review documents.
            With aligned=True, the word index is taken into account when training on lists of words.
        """
        self._aligned  = aligned
        self._classes  = {} # Frequency of each class (or type).
        self._features = {} # Frequency of each feature, as (type, feature, value)-tuples.
        self._count    = 0  # Number of training instances.
    
    @property
    def classes(self):
        return self._classes.keys()
        
    @property
    def features(self):
        return list(set(k[1] for k in self._features.iterkeys()))

    def train(self, document, type=None):
        """ Trains the classifier with the given document of the given type (i.e., class).
            A document can be a Document object or a list of words (or other hashable items).
            If no type is given, Document.type will be used instead.
        """
        id = self._aligned and NBid1 or NBid2
        type, vector = self._vector(document, type=type)
        self._classes[type] = self._classes.get(type, 0) + 1
        for i, (w, f) in enumerate(vector.iteritems()):
            self._features[id(type, w, i)] = self._features.get(id(type, w, i), 0) + f
        self._count += 1

    def classify(self, document):
        """ Returns the type with the highest probability for the given document
            (a Document object or a list of words).
            If the training documents come from a LSA-reduced corpus,
            the given document must be Corpus.lsa.transform(document).
        """
        id = self._aligned and NBid1 or NBid2
        def g(document, type):
            # Bayesian discriminant, proportional to posterior probability.
            g = 1.0 * self._classes[type] / self._count
            for i, (w, f) in enumerate(self._vector(document)[1].iteritems()):
                g /= self._classes[type]
                g *= self._features.get(id(type, w, i), 0) 
                g *= f
            return g
        try:
            return max((g(document, type), type) for type in self._classes)[1]
        except ValueError: # max() arg is an empty sequence
            return None

Bayes = NaiveBayes

#--- K-NEAREST NEIGHBOR CLASSIFIER -------------------------------------------------------------------

class NearestNeighbor(Classifier):
    
    def __init__(self, k=10, distance=COSINE):
        """ k-nearest neighbor (kNN) is a simple supervised learning method for text classification.
            Documents are classified by a majority vote of nearest neighbors (cosine distance)
            in the training corpus.
        """
        self.k = k               # Number of nearest neighbors to observe.
        self.distance = distance # COSINE, EUCLIDEAN, ...
        self._vectors = []       # Training instances.
        self._kdtree  = None
    
    @property
    def classes(self):
        return list(set(type for type, v in self._vectors))
        
    @property
    def features(self):
        return list(features(v for type, v in self._vectors))
    
    def train(self, document, type=None):
        self._vectors.append(self._vector(document, type=type))
    
    def classify(self, document):
        # Basic majority voting.
        # Distance is calculated between the document vector and all training instances.
        # This will make NearestNeighbor.test() slow in higher dimensions.
        classes = {}
        v1 = self._vector(document)[1]
        # k-d trees are slower than brute-force for vectors with high dimensionality:
        #if self._kdtree is None:
        #    self._kdtree = kdtree((v for type, v in self._vectors))
        #    self._kdtree.map = dict((id(v), type) for type, v in self._vectors)
        #D = self._kdtree.nearest_neighbors(v1, self.k, self.distance)
        D = ((distance(v1, v2, method=self.distance), type) for type, v2 in self._vectors)
        D = ((d, type) for d, type in D if d < 1) # Nothing in common if distance=1.0.
        D = heapq.nsmallest(self.k, D)            # k-least distant.
        for d, type in D:
            f = 1 / (d or 0.0000000001)
            classes[type] = type in classes and classes[type]+f or f
        try:
            # Pick random winner if several candidates have equal highest score.
            return choice([k for k, v in classes.iteritems() if v == max(classes.values()) > 0])
        except IndexError:
            return None

kNN = KNN = NearestNeighbor

#d1 = Document("cats have stripes, purr and drink milk", type="cat", threshold=0, stemmer=None)
#d2 = Document("cows are black and white, they moo and give milk", type="cow", threshold=0, stemmer=None)
#d3 = Document("birds have wings and can fly", type="bird", threshold=0, stemmer=None)
#knn = kNN()
#for d in (d1,d2,d3):
#    knn.train(d)
#print knn.binary
#print knn.classes
#print knn.classify(Document("something that can fly", threshold=0, stemmer=None))
#print NearestNeighbor.test((d1,d2,d3), folds=2)

#### K-D TREE ########################################################################################

class KDTree:

    _v1 = Vector({0:0})
    _v2 = Vector({0:0})
    
    def __init__(self, vectors, map={}):
        """ A partitioned vector space that is (sometimes) faster for nearest neighbor search.
            A k-d tree is an extension of a binary tree for k-dimensional data,
            where every vector generates a hyperplane that splits the space into two subspaces.
        """
        class Node:
            def __init__(self, vector, left, right, axis):
                self.vector, self.left, self.right, self.axis = vector, left, right, axis
        def balance(vectors, depth=0, keys=None):
            # Based on: http://en.wikipedia.org/wiki/Kd-tree
            if not vectors:
                return None
            if not keys:
                keys = sorted(features(vectors))
            a = keys[depth % len(keys)] # splitting axis
            v = sorted(vectors, key=lambda v: v.get(a, 0))
            m = len(v) // 2 # median pivot
            return Node(
                vector = v[m],
                  left = balance(v[:m], depth+1, keys), 
                 right = balance(v[m+1:], depth+1, keys), 
                  axis = a)
        self.map = map
        self.root = balance([self._vector(v) for v in vectors])

    def _vector(self, v):
        """ Returns a Vector for the given document or vector.
        """
        if isinstance(v, Document):
            self.map.setdefault(id(v.vector), v); return v.vector
        return v
        
    def nearest_neighbors(self, vector, k=10, distance=COSINE):
        """ Returns a list of (distance, vector)-tuples from the search space, 
            sorted nearest-first to the given vector.
        """
        class NN(list):
            def update(self, v1, v2):
                d = _distance(v1, v2, method=distance)
                if len(self) < k or self[-1][0] > d:
                    # Add nearer vectors to the sorted list.
                    insort(self, (d, v1))
                    
        def search(self, vector, k, best=NN()):
            # Based on: http://code.google.com/p/python-kdtree/
            if self is None:
                return best
            if self.left is self.right is None: # leaf
                best.update(self.vector, vector)
                return best
            # Compare points in current dimension to select near and far subtree.
            # We may need to search the far subtree too (see below).
            if vector.get(self.axis) < self.vector.get(self.axis):
                near, far = self.left, self.right
            else:
                near, far = self.right, self.left
            # Recursively search near subtree down to leaf.
            best = search(near, vector, k, best)
            best.update(self.vector, vector)
            # It's faster to reuse two Vectors than to create them:
            dict.__setitem__(KDTree._v1, 0, self.vector.get(self.axis, 0))
            dict.__setitem__(KDTree._v2, 0, vector.get(self.axis, 0))
            KDTree._v1._norm = None # clear norm cache
            KDTree._v2._norm = None
            # If the hypersphere crosses the plane, 
            # there could be nearer points on the far side of the plane.
            if _distance(KDTree._v1, KDTree._v2, method=distance) <= best[-1][0]:
                best = search(far, vector, k, best)
            return best
                
        n = search(self.root, self._vector(vector), k+1)
        n = [(d, self.map.get(id(v),v)) for d, v in n]
        n = [(d, v) for d, v in n if v != vector][:k]
        return n
        
    nn = nearest_neighbors

kdtree = KDTree

#### GENETIC ALGORITHM ###############################################################################

class GeneticAlgorithm:
    
    def __init__(self, candidates=[], **kwargs):
        """ A genetic algorithm is a stochastic search method  based on natural selection.
            Each generation, the fittest candidates are selected and recombined into a new generation. 
            With each new generation the system converges towards an optimal fitness.
        """
        self.population = candidates
        self.generation = 0
        self._avg = None # Average fitness for this generation.
        # GeneticAlgorithm.fitness(), crossover(), mutate() can be given as functions:
        for f in ("fitness", "crossover", "mutate"):
            if f in kwargs: 
                setattr(self, f, kwargs[f])
    
    def fitness(self, candidate):
        # Must be implemented in a subclass, returns 0.0-1.0.
        return 1.0
    
    def crossover(self, candidate1, candidate2, d=0.5):
        # Must be implemented in a subclass.
        return None
        
    def mutate(self, candidate, d=0.1):
        # Must be implemented in a subclass.
        return None or candidate
        
    def update(self, top=0.7, crossover=0.5, mutation=0.1, d=0.9):
        """ Updates the population by selecting the top fittest candidates,
            and recombining them into a new generation.
        """
        # Selection.
        p = sorted((self.fitness(x), x) for x in self.population) # Weakest-first.
        a = self._avg = float(sum(f for f, x in p)) / len(p)
        print len(p), ["%.2f"%f for f,x in p][:20]
        x = min(f for f, x in p)
        y = max(f for f, x in p)
        i = 0
        while len(p) > len(self.population) * top:
            # Weaker candidates have a higher chance of being removed,
            # chance being equal to (1-fitness), starting with the weakest.
            if x + (y-x) * random() >= p[i][0]:
                p.pop(i)
            else:
                i = (i+1) % len(p)
        # Reproduction.
        g = []
        while len(g) < len(self.population):
            # Choose randomly between recombination of parents or mutation.
            # Mutation avoids local optima by maintaining genetic diversity.
            if random() < d:
                i = int(round(random() * (len(p)-1)))
                j = choice(range(0,i) + range(i+1, len(p)))
                g.append(self.crossover(p[i][1], p[j][1], d=crossover))
            else:
                g.append(self.mutate(choice(p)[1], d=mutation))
        self.population = g
        self.generation += 1
        
    @property
    def avg(self):
        # Average fitness is supposed to increase each generation.
        if not self._avg: self._avg = float(sum(map(self.fitness, self.population))) / len(self.population)
        return self._avg
    
    average_fitness = avg

GA = GeneticAlgorithm

# GA for floats between 0.0-1.0 that prefers higher numbers:
#class HighFloatGA(GeneticAlgorithm):
#    def fitness(self, x):
#        return x
#    def crossover(self, x, y, d=0.5):
#        return (x+y) / 2
#    def mutate(self, x, d=0.1):
#        return min(1, max(0, x + random()*0.2-0.1))
#
#ga = HighFloatGA([random() for i in range(100)])
#for i in range(100):
#    ga.update()
#    print ga.average_fitness
#print ga.population
