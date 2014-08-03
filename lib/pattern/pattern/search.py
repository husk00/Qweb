#### PATTERN | EN | PATTERN MATCHING #################################################################
# Copyright (c) 2010 University of Antwerp, Belgium
# Author: Tom De Smedt <tom@organisms.be>
# License: BSD (see LICENSE.txt for details).
# http://www.clips.ua.ac.be/pages/pattern

######################################################################################################

import re

# Following classes emulate those in en.parser.tree:

class Text(list):
    def __init__(self, string="", token=["word"]):
        list.__init__(self, [Sentence(s+".", token) for s in string.split(".")])
    @property
    def sentences(self):
        return self

class Sentence:
    def __init__(self, string="", token=["word"]):
        for punctuation in ".,;?!:": # Naive tokenization.
            string = string.replace(punctuation, " "+punctuation)
        string = re.sub(r"\s+", " ", string)
        string = string.split(" ")
        self.words = [Word(self, w, index=i) for i,w in enumerate(string)]
    @property
    def chunks(self):
        return []

class Word:
    def __init__(self, sentence, string, tag=None, index=0):
        self.sentence, self.string, self.tag, self.index = sentence, string, tag, index
    def __repr__(self):
        return "Word(%s)" % repr(self.string)
    @property
    def chunk(self): 
        return None
    @property
    def lemma(self):
        return None

#--- STRING MATCHING ---------------------------------------------------------------------------------

WILDCARD = "*"
regexp = type(re.compile(r"."))

def _match(string, pattern):
    """ Returns True if the pattern is part of the given word string.
        The pattern can include a wildcard (*front, back*, *both*, in*side),
        or it can be a compiled regular expression.
    """
    p = pattern
    try:
        if p.startswith(WILDCARD) and (p.endswith(WILDCARD) and p[1:-1] in string or string.endswith(p[1:])):
            return True
        if p.endswith(WILDCARD) and not p.endswith("\\"+WILDCARD) and string.startswith(p[:-1]):
            return True
        if p == string:
            return True
        if WILDCARD in p[1:-1]:
            p = p.split(WILDCARD)
            return string.startswith(p[0]) and string.endswith(p[-1])
    except AttributeError:
        # For performance (doing isinstance() at the end is 10% faster for regular strings).
        if isinstance(p, regexp):
            return p.search(string) is not None
    return False

#--- LIST FUNCTIONS ----------------------------------------------------------------------------------

def unique(list):
    """ Returns a list copy in which each item occurs only once.
    """
    u=[]; [u.append(item) for item in list if item not in u]
    return u
    
def unique2(list):
    """ Returns a list copy in which each item occurs only once.
        This is faster than unique(), but list items must be hashable.
    """
    u, s = [], {}
    for item in list:
        if item not in s: u.append(item)
        s[item] = True
    return u

def find(function, list):
    """ Returns the first item in the list for which function(item) is True, None otherwise.
    """
    for item in list:
        if function(item) is True:
            return item

def combinations(list, n):
    """ Returns all possible combinations of length n of the given items in the list.
    """
    if n == 0: yield []
    else:
        for i in xrange(len(list)):
            for c in combinations(list, n-1):
                yield [list[i]] + c

def variations(list, optional=lambda item: False):
    """ Returns all possible variations of a list containing optional items.
    """
    # Boolean pattern, True where pattern is optional.
    # (A) (B) C --> True True False
    o = [optional(item) for item in list]
    V = []
    # All the possible True/False combinations of optionals.
    # (A) (B) C --> True True, True False, False True, False False.
    for c in combinations([True, False], sum(o)):
        # If True in boolean pattern, replace by boolean in current combination.
        # (A) (B) C --> True True False, True False False, False True False, False False False.
        v = [b and (b and c.pop(0)) for b in o]
        # Replace True by pattern at that index.
        # --> (A) (B) C, (A) C, (B) C, C.
        v = [list[i] for i in range(len(v)) if not v[i]]
        if v not in V: 
            V.append(v)
    # Longest-first.
    V.sort(lambda a, b: len(b) - len(a))
    return V

#### TAXONOMY ########################################################################################

#--- ORDERED DICTIONARY ------------------------------------------------------------------------------

class odict(dict):
    """ Dictionary with ordered keys.
        With reversed=True, the latest keys will be returned first when traversing the dictionary.
        Taxonomy (see below) uses ordered dictionaries:
        if a taxonomy term has multiple parents, the last parent is the default.
    """
    def __init__(self, d=None, reversed=True):
        dict.__init__(self)
        self._o = [] # The ordered keys.
        self._f = reversed and self._insertkey or self._appendkey
        if d != None: self.update(dict(d))
    @property
    def reversed(self):
        return self._f == self._insertkey
    @classmethod
    def fromkeys(odict, k, v=None, reversed=True):
        d = odict(reversed=reversed)
        for k in k: d.__setitem__(k,v)
        return d
    def _insertkey(self, k):
        if k not in self: self._o.insert(0,k) # Sort newest-first with reversed=True.
    def _appendkey(self, k):
        if k not in self: self._o.append(k)   # Sort oldest-first with reversed=False.
    def append(self, (k, v)):
        """ Takes a (key, value)-tuple. Sets the given key to the given value.
            If the key exists, pushes the updated item to the head (or tail) of the dict.
        """
        if k in self: self.__delitem__(k)
        self.__setitem__(k,v)
    def update(self, d):
        for k,v in d.items(): self.__setitem__(k,v)
    def setdefault(self, k, v=None):
        if not k in self: self.__setitem__(k,v)
        return self[k]        
    def __setitem__(self, k, v): 
        self._f(k); dict.__setitem__(self, k, v)
    def __delitem__(self, k):
        dict.__delitem__(self, k); self._o.remove(k)
    def pop(self, k):
        self._o.remove(k); return dict.pop(self, k)
    def clear(self):
        dict.clear(self); self._o=[]
    def keys(self): 
        return self._o
    def values(self):
        return map(self.get, self._o)
    def items(self): 
        return zip(self._o, self.values())
    def __iter__(self):
        return self._o.__iter__()
    def copy(self):
        d = self.__class__(reversed=self.reversed)
        for k,v in (self.reversed and reversed(self.items()) or self.items()): d[k] = v
        return d
    def __repr__(self):
        return "{%s}" % ", ".join(["%s: %s" % (repr(k), repr(v)) for k, v in self.items()])

#--- TAXONOMY ----------------------------------------------------------------------------------------

class Taxonomy(dict):
    
    def __init__(self):
        """ Hierarchical tree of words classified by semantic type.
            For example: "rose" and "daffodil" can be classified as "flower":
            taxonomy.append("rose", type="flower")
            taxonomy.append("daffodil", type="flower")
            print taxonomy.children("flower")
            Taxonomy terms can be used in a Pattern:
            FLOWER will match "flower" as well as "rose" and "daffodil".
            The taxonomy is case insensitive by default.
        """
        self.case_sensitive = False
        self._values = {}
        self.classifiers = []
        
    def _normalize(self, term):
        try: 
            return not self.case_sensitive and term.lower() or term
        except: # Not a string.
            return term

    def __contains__(self, term):
        # Check if the term is in the dictionary.
        # If the term is not in the dictionary, check the classifiers.
        term = self._normalize(term)
        if dict.__contains__(self, term):
            return True
        for classifier in self.classifiers:
            if classifier.parents(term) \
            or classifier.children(term):
                return True
        return False

    def append(self, term, type=None, value=None):
        """ Appends the given term to the taxonomy and tags it as the given type.
            Optionally, a disambiguation value can be supplied.
            For example: taxonomy.append("many", "quantity", "50-200")
        """
        term = self._normalize(term)
        type = self._normalize(type)
        self.setdefault(term, (odict(), odict()))[0].append((type, True))
        self.setdefault(type, (odict(), odict()))[1].append((term, True))
        self._values[term] = value
    
    def classify(self, term, **kwargs):
        """ Returns the (most recently added) semantic type for the given term ("many" => "quantity").
            If the term is not in the dictionary, try Taxonomy.classifiers.
        """
        term = self._normalize(term)
        if dict.__contains__(self, term):
            return self[term][0].keys()[-1]
        # If the term is not in the dictionary, check the classifiers.
        # Returns the first term in the list returned by a classifier.
        for classifier in self.classifiers:
            # **kwargs are useful if the classifier requests extra information,
            # for example the part-of-speech tag.
            v = classifier.parents(term, **kwargs)
            if v:
                return v[0]
            
    def parents(self, term, recursive=False, **kwargs):
        """ Returns a list of all semantic types for the given term.
            If recursive=True, traverses parents up to the root.
        """
        def dfs(term, recursive=False, visited={}, **kwargs):
            if term in visited: # Break on cyclic relations.
                return []
            visited[term], a = True, []
            if dict.__contains__(self, term):
                a = self[term][0].keys()
            for classifier in self.classifiers:
                a.extend(classifier.parents(term, **kwargs) or [])
            if recursive:
                for w in a: a += dfs(w, recursive, visited, **kwargs)
            return a
        return unique2(dfs(self._normalize(term), recursive, {}, **kwargs))
    
    def children(self, term, recursive=False, **kwargs):
        """ Returns all terms of the given semantic type: "quantity" => ["many", "lot", "few", ...]
            If recursive=True, traverses children down to the leaves.
        """
        def dfs(term, recursive=False, visited={}, **kwargs):
            if term in visited: # Break on cyclic relations.
                return []
            visited[term], a = True, []
            if dict.__contains__(self, term):
                a = self[term][1].keys()
            for classifier in self.classifiers:
                a.extend(classifier.children(term, **kwargs) or [])
            if recursive:
                for w in a: a += dfs(w, recursive, visited, **kwargs)
            return a
        return unique2(dfs(self._normalize(term), recursive, {}, **kwargs))
    
    def value(self, term, **kwargs):
        """ Returns the value of the given term ("many" => "50-200")
        """
        term = self._normalize(term)
        if term in self._values:
            return self._values[term]
        for classifier in self.classifiers:
            v = classifier.value(term, **kwargs)
            if v is not None:
                return v
        
    def remove(self, term):
        if dict.__contains__(self, term):
            for w in self.parents(term):
                self[w][1].pop(term)
            dict.pop(self, term) 

# Global taxonomy:
TAXONOMY = taxonomy = Taxonomy()

#taxonomy.append("rose", type="flower")
#taxonomy.append("daffodil", type="flower")
#taxonomy.append("flower", type="plant")
#print taxonomy.classify("rose")
#print taxonomy.children("plant", recursive=True)

#c = Classifier(parents=lambda term: term.endswith("ness") and ["quality"] or [])
#taxonomy.classifiers.append(c)
#print taxonomy.classify("roughness")

#--- TAXONOMY CLASSIFIER -----------------------------------------------------------------------------

class Classifier:
    
    def __init__(self, parents=lambda term: [], children=lambda term: [], value=lambda term: None):
        """ A classifier uses a rule-based approach to enrich the taxonomy, for example:
            c = Classifier(parents=lambda term: term.endswith("ness") and ["quality"] or [])
            taxonomy.classifiers.append(c)
            This tags any word ending in -ness as "quality".
            This is much shorter than manually adding "roughness", "sharpness", ...
            Other examples of useful classifiers: calling en.wordnet.Synset.hyponyms() or en.number().
        """
        self.parents  = parents
        self.children = children
        self.value    = value

# Classifier(parents=lambda word: word.endswith("ness") and ["quality"] or [])
# Classifier(parents=lambda word, chunk=None: chunk=="VP" and [ACTION] or [])

class WordNetClassifier(Classifier):
    
    def __init__(self, wordnet=None):
        Classifier.__init__(self, self._parents, self._children)
        self.wordnet = wordnet

    def _children(self, word, pos="NN"):
        try: return [w.senses[0] for w in self.wordnet.synsets(word, pos)[0].hyponyms]
        except KeyError:
            pass
        
    def _parents(self, word, pos="NN"):
        try: return [w.senses[0] for w in self.wordnet.synsets(word, pos)[0].hypernyms]
        except KeyError:
            pass

#from en import wordnet
#taxonomy.classifiers.append(WordNetClassifier(wordnet))
#print taxonomy.parents("ponder", pos="VB")
#print taxonomy.children("computer")

#### PATTERN #########################################################################################

#--- PATTERN CONSTRAINT ------------------------------------------------------------------------------

# Allowed chunk, role and part-of-speech tags (Penn Treebank II):
CHUNKS = dict.fromkeys(["NP", "PP", "VP", "ADVP", "ADJP", "SBAR", "PRT", "INTJ"], True)
ROLES  = dict.fromkeys(["SBJ", "OBJ", "PRD", "TMP", "CLR", "LOC", "DIR", "EXT", "PRP"], True)
TAGS   = dict.fromkeys(["CC", "CD", "DT", "EX", "FW", "IN", "JJ", "JJR", "JJS", "JJ*", 
                        "LS", "MD", "NN", "NNS", "NNP", "NNPS", "NN*", "PDT", "PRP", 
                        "PRP$", "PRP*", "RB", "RBR", "RBS", "RB*", "RP", "SYM", "TO", 
                        "UH", "VB", "VBZ", "VBP", "VBD", "VBN", "VBG", "VB*", 
                        "WDT", "WP*", "WRB", ".", ",", ":", "(", ")"], True)

ALPHA = re.compile("[a-zA-Z]")
has_alpha = lambda string: ALPHA.match(string) is not None

class Constraint:
    
    def __init__(self, words=[], tags=[], chunks=[], roles=[], taxa=[], optional=False, multiple=False, first=False,  taxonomy=TAXONOMY):
        """ A range of words, tags and taxonomy terms that matches certain words in a sentence.        
            For example: 
            Constraint.fromstring("with|of") matches either "with" or "of".
            Constraint.fromstring("(JJ)") optionally matches an adjective.
            Constraint.fromstring("NP|SBJ") matches subject noun phrases.
            Constraint.fromstring("QUANTITY|QUALITY") matches quantity-type and quality-type taxa.
        """
        self.index    = 0
        self.words    = list(words)  # Allowed words/lemmata (of, with, ...)
        self.tags     = list(tags)   # Allowed parts-of-speech (NN, JJ, ...)
        self.chunks   = list(chunks) # Allowed chunk types (NP, VP, ...)
        self.roles    = list(roles)  # Allowed chunk roles (SBJ, OBJ, ...)
        self.taxa     = list(taxa)   # Allowed word categories.
        self.taxonomy = taxonomy
        self.optional = optional
        self.multiple = multiple
        self.first    = first
        self.exclude  = None         # Constraint of words that are *not* allowed.
        
    @classmethod
    def fromstring(self, s, **kwargs):
        """ Returns a new Constraint from the given string.
            Uppercase words indicate either a tag ("NN", "JJ", "VP")
            or a taxonomy term (e.g. "PRODUCT", "PERSON").
            Syntax:
            ( defines an optional constraint, e.g. "(JJ)".
            [ defines a constraint with spaces, e.g. "[Mac OS X | Windows Vista]".
            _ is converted to spaces, e.g. "Windows_Vista".
            | separates different options, e.g. "ADJP|ADVP".
            ! can be used as a word prefix to disallow it.
            * can be used as a wildcard character, e.g. "soft*|JJ*".
            + as a suffix defines a constraint that can span multiple words, e.g. "*+".
            ^ as a prefix defines a constraint that can only match the first word.
            These characters need to be escaped if used as content: "\(".
        """
        C = self(**kwargs)
        if s.startswith("^"):
            s = s[1:  ]; C.first = True
        if s.endswith("+") and not s.endswith("\+"):
            s = s[0:-1]; C.multiple = True
        if s.startswith("(") and s.endswith(")"):
            s = s[1:-1]; C.optional = True
        if s.startswith("[") and s.endswith("]"):
            s = s[1:-1]
        s = s.replace("\_", "&underscore;")
        s = s.replace("_"," ")
        s = s.replace("&underscore;", "_")
        s = s.replace("&lbracket;", "(")
        s = s.replace("&rbracket;", ")")
        s = s.replace("&lsqbracket;", "[")
        s = s.replace("&rsqbracket;", "]")
        s = s.replace("\(", "(")
        s = s.replace("\)", ")")
        s = s.replace("\[", "[")
        s = s.replace("\]", "]")
        s = s.replace("\|", "&dash;")
        s = s.split("|")
        s = [v.replace("&dash;", "|").strip() for v in s]
        for v in s:
            C._append(v)
        return C
        
    def _append(self, v):
        if v.startswith("!") and self.exclude is None:
            self.exclude = Constraint()
        if v.startswith("!"):
            self.exclude._append(v[1:]); return
        if "!" in v:
            v = v.replace("\!", "!")
        if v != v.upper():
            self.words.append(v.lower())
        elif v in TAGS:
            self.tags.append(v)
        elif v in CHUNKS:
            self.chunks.append(v)
        elif v in ROLES:
            self.roles.append(v)
        elif v in taxonomy or has_alpha(v):
            self.taxa.append(v.lower())
        else:
            # Uppercase words indicate tags or taxonomy terms.
            # However, this also matches "*" or "?" or "0.25".
            # Unless such punctuation is defined in the taxonomy, it is added to Range.words.
            self.words.append(v.lower())
    
    def match(self, word):
        """ Return True if the given Word is part of the constraint:
            - the word (or lemma) occurs in Constraint.words, OR
            - the word (or lemma) occurs in Constraint.taxa taxonomy tree, AND
            - the word and/or chunk tags match those defined in the constraint.
            Individual terms in Constraint.words or the taxonomy can contain wildcards (*).
            Some part-of-speech-tags can also contain wildcards: NN*, VB*, JJ*, RB*
            If the given word contains spaces (e.g. proper noun),
            the entire chunk will also be compared.
            For example: Constraint(words=["Mac OS X*"]) 
            matches the word "Mac" if the word occurs in a Chunk("Mac OS X 10.5").
        """
        # If the constraint can only match the first word, Word.index must be 0.
        if self.first and word.index > 0:
            return False
        # If the constraint defines excluded options, Word can not match any of these.
        if self.exclude and self.exclude.match(word):
            return False
        # If the constraint defines allowed tags, Word.tag needs to match one of these.
        if self.tags:
            if find(lambda w: _match(word.tag, w), self.tags) is None:
                return False
        # If the constraint defines allowed chunks, Word.chunk.tag needs to match one of these.
        if self.chunks:
            ch = word.chunk and word.chunk.tag or None
            if find(lambda w: _match(ch, w), self.chunks) is None:
                return False
        # If the constraint defines allowed role, Word.chunk.tag needs to match one of these.
        if self.roles:
            R = word.chunk and [r2 for r1,r2 in word.chunk.relations] or []
            if find(lambda w: w in R, self.roles) is None:
                return False
        # If the constraint defines allowed words,
        # Word.string.lower() OR Word.lemma needs to match one of these.
        b = True # b==True when word in constraint (or Constraints.words=[]).
        if self.words + self.taxa:
            s1 = word.string.lower()
            s2 = word.lemma
            b = False
            for w in self.words + self.taxa:
                # If the constraint has a word with spaces (e.g. a proper noun),
                # compare it to the entire chunk.
                try:
                    if " " in w and (s1 in w or s2 and s2 in w or "*" in w):
                        s1 = word.chunk and word.chunk.string.lower() or s1
                        s2 = word.chunk and " ".join([x or "" for x in word.chunk.lemmata]) or s2
                except:
                    s1 = s1
                    s2 = None
                # Compare the word to the allowed words (which can contain wildcards).
                if _match(s1, w):
                    b=True; break
                # Compare the word lemma to the allowed words, e.g.
                # if "was" is not in the constraint, perhaps "be" is, which is a good match.
                if s2 and _match(s2, w):
                    b=True; break
        # If the constraint defines allowed taxonomy terms,
        # and the given word did not match an allowed word, traverse the taxonomy.
        # The search goes up from the given word to its parents in the taxonomy.
        # This is faster than traversing all the children of terms in Constraint.taxa.
        # The drawback is that:
        # 1) Wildcards in the taxonomy are not detected (use classifiers instead),
        # 2) Classifier.children() has no effect, only Classifier.parent().
        if self.taxa and (not self.words or (self.words and not b)):
            for s in (
              word.string, # "ants"
              word.lemma,  # "ant"
              word.chunk and word.chunk.string or None, # "army ants"
              word.chunk and " ".join([x or "" for x in word.chunk.lemmata]) or None): # "army ant"
                if s is not None:
                    # Compare ancestors of the word to each term in Constraint.taxa.
                    for p in self.taxonomy.parents(s.lower(), recursive=True):
                        if find(lambda s: p==s, self.taxa): # No wildcards.
                            return True
        return b
    
    def __repr__(self):
        s = []
        for k,v in (
          ( "words", self.words),
          (  "tags", self.tags),
          ("chunks", self.chunks),
          ( "roles", self.roles),
          (  "taxa", self.taxa)):
            if v: s.append("%s=%s" % (k, repr(v)))
        return "Constraint(%s)" % ", ".join(s)
            
    @property
    def string(self):
        a = self.words + self.tags + self.chunks + self.roles + [w.upper() for w in self.taxa]
        for i, s in enumerate(a):
            a[i] = s.replace(" ", "_")
            a[i] = s.replace("+", "\+")
            a[i] = s.replace("|", "\|")
            a[i] = s.replace("(", "\(")
            a[i] = s.replace(")", "\)")
            a[i] = s.replace("[", "\[")
            a[i] = s.replace("]", "\]")
        return (self.optional and "(%s)" or "[%s]") % "|".join(a)

#--- PATTERN -----------------------------------------------------------------------------------------

STRICT = "strict"

class Pattern:
    
    def __init__(self, sequence=[], *args):
        """ A sequence of constraints that matches certain phrases in a sentence.
        """
        self.sequence = list(sequence) # List of constraints.
        self.strict = STRICT in args
        
    def __iter__(self):
        return iter(self.sequence)
    def __len__(self):
        return len(self.sequence)
    def __getitem__(self, i):
        return self.sequence[i]
        
    @classmethod
    def fromstring(self, s, *args, **kwargs):
        """ Returns a new Pattern from the given string.
            Constraints are separated by a space.
            If a constraint contains a space, it must be wrapped in [].
        """
        s = s.replace("\(","&lbracket;")
        s = s.replace("\)","&rbracket;")
        s = s.replace("\[","&lsqbracket;")
        s = s.replace("\]","&rsqbracket;")
        p = []
        i = 0
        for m in re.finditer(r"\[.*?\]|\(.*?\)", s):
            # Spaces in a range encapsulated in square brackets are encoded.
            # "[Windows Vista]" is one range, don't split on space.
            p.append(s[i:m.start()])
            p.append(s[m.start():m.end()].replace(" ", "&space;")); i=m.end()
        p.append(s[i:])
        s = "".join(p) 
        s = s.replace("\|", "&dash;")
        s = re.sub("\s+\|\s+", "|", s)       
        s = s.split(" ")
        s = [v.replace("&space;"," ") for v in s]
        P = self([], *args)
        for s in s:
            P.sequence.append(Constraint.fromstring(s, taxonomy=kwargs.get("taxonomy", TAXONOMY)))
        return P

    def search(self, sentence):
        """ Returns a list of all matches found in the given sentence.
        """
        if sentence.__class__.__name__ == "Text":
            a=[]; [a.extend(self.search(s)) for s in sentence]; return a
        a = []
        v = self._variations()
        m = self.match(sentence, _v=v)
        while m:
            a.append(m)
            m = self.match(sentence, start=m.words[-1].index+1, _v=v)
        return a
        
    def match(self, sentence, start=0, _v=None):
        """ Returns the first match found in the given sentence, or None.
        """
        if sentence.__class__.__name__ == "Text":
            return find(lambda (m,s): m!=None, ((self.match(s, start, _v), s) for s in sentence))[0]
        if isinstance(sentence, basestring):
            sentence = Sentence(sentence)
        for sequence in (_v is not None and _v or self._variations()):
            m = self._match(sequence, sentence, start)
            if m:
                return m

    def _variations(self):
        v = variations(self.sequence, optional=lambda constraint: constraint.optional)
        v = sorted(v, key=len, reverse=True)
        return v
                
    def _match(self, sequence, sentence, start=0, i=0, w0=None, map=None, d=0):
        # Backtracking tree search.
        # Finds the first match in the sentence of the given sequence of constraints.
        # start : the current word index.
        #     i : the current constraint index.
        #    w0 : the first word that matches a constraint.
        #   map : a dictionary of (Word index, Constraint) items.
        #     d : recursion depth.
        
        # XXX - We can probably rewrite all of this using (faster) regular expressions.
        
        if map is None:
            map = {}

        # MATCH
        if i == len(sequence):
            if w0 is not None:
                w1 = sentence.words[start-1]
                # Consider Pattern.fromstring("[*big_cat]"):
                # - If it stops on "the", include the successive "big" and "cat" in the chunk.
                # - If it starts on "big", include the preceding "the" in the chunk.
                # - Rule is ignored for POS-tag constraints (can only match single word).
                if w0.chunk is not None and not sequence[0].tags:
                    if self.strict is False:
                        w0 = w0.chunk.words[0]
                    for w in reversed(w0.chunk.words[:w0.index-w0.chunk.start]):
                        if sequence[0].match(w): w0=w 
                        else: 
                            break
                if w1.chunk is not None and not sequence[-1].tags:
                    for w in w1.chunk.words[w1.index-w1.chunk.start+1:]:
                        if sequence[-1].match(w): w1=w
                        else:
                            break
                # Update map for optional chunk words (see below).
                words = sentence.words[w0.index:w1.index+1]
                for w in words:
                    if w.index not in map and w.chunk:
                        wx = find(lambda w: w.index in map, reversed(w.chunk.words))
                        if wx: 
                            map[w.index] = map[wx.index]
                # Return matched word range, we'll need the map to build Match.constituents().
                return Match(self, words, map)
            return None

        # RECURSION
        for w in sentence.words[start:]:
            #print " "*d, "match?", w, sequence[i].string # DEBUG
            if i < len(sequence) and sequence[i].match(w):
                #print " "*d, "match!", w, sequence[i].string # DEBUG
                map[w.index] = sequence[i]
                if sequence[i].multiple:
                    # Next word vs. same constraint if Constraint.multiple=True.
                    m = self._match(sequence, sentence, w.index+1, i, w0 or w, map, d+1)
                    if m: return m
                # Next word vs. next constraint.
                m = self._match(sequence, sentence, w.index+1, i+1, w0 or w, map, d+1)
                if m: return m
            # Chunk words other than the head are optional:
            # - Pattern.fromstring("cat") matches "cat" but also "the big cat" (overspecification).
            # - Pattern.fromstring("cat|NN") does not match "the big cat" (explicit POS-tag).
            if w0 and len(sequence[i].tags) == 0:
                if self.strict is False and w.chunk is not None and w.chunk.head != w :
                    continue
                break
            # Part-of-speech tags match one single word.
            if w0 and len(sequence[i].tags) > 0:
                break

_cache = {}
_CACHE_SIZE = 100 # Number of dynamic Pattern objects to keep in cache.
def compile(pattern, *args, **kwargs):
    id = repr(pattern)+repr(args)
    if id in _cache:
        return _cache[id]
    if isinstance(pattern, basestring):
        p = Pattern.fromstring(pattern, *args, **kwargs)
    if isinstance(pattern, regexp):
        p = Pattern([Constraint(words=[pattern], taxonomy=kwargs.get("taxonomy", TAXONOMY))], *args)
    if len(_cache) > _CACHE_SIZE:
        _cache.clear()
    _cache[id] = p
    return p

def match(pattern, sentence, *args, **kwargs):
    return compile(pattern, *args).match(sentence) 

def search(pattern, sentence, *args, **kwargs):
    return compile(pattern, *args).search(sentence)

#--- PATTERN MATCH -----------------------------------------------------------------------------------

class Match:
    
    def __init__(self, pattern, words=[], map={}):
        """ Search result returned from Pattern.match(sentence),
            containing a sequence of Word objects.
        """
        self.pattern = pattern
        self.words = words
        self._map1 = dict() # Word index to Constraint.
        self._map2 = dict() # Constraint index to list of Word indices.
        for w in self.words:
            self._map1[w.index] = map[w.index]
        for k,v in self._map1.items():
            self._map2.setdefault(self.pattern.sequence.index(v),[]).append(k)
        for k,v in self._map2.items():
            v.sort()

    def __len__(self):
        return len(self.words)
    def __iter__(self):
        return iter(self.words)
    def __getitem__(self, i):
        return self.words.__getitem__(i)

    @property
    def start(self):
        return self.words and self.words[0].index or None
    @property
    def stop(self):
        return self.words and self.words[-1].index+1 or None

    def constraint(self, word):
        """ Returns the constraint that matches the given Word, or None.
        """
        if word.index in self._map1:
            return self._map1[word.index]
    
    def constraints(self, chunk):
        """ Returns a list of constraints that match the given Chunk.
        """
        a = [self._map1[w.index] for w in chunk.words if w.index in self._map1]
        b = []; [b.append(constraint) for constraint in a if constraint not in b]
        return b

    def constituents(self, constraint=None):
        """ Returns a list of Word and Chunk objects, 
            where words have been grouped into their chunks whenever possible.
            Optionally, returns only chunks/words that match given constraint(s), or constraint index.
        """
        # Select only words that match the given constraint.
        # Note: this will only work with constraints from Match.pattern.sequence.
        W = self.words
        n = len(self.pattern.sequence)
        if isinstance(constraint, (int, Constraint)):
            if isinstance(constraint, int):
                i = constraint 
                i = i<0 and i%n or i
            else:
                i = self.pattern.sequence.index(constraint)
            W = self._map2.get(i,[])
            W = [self.words[i-self.words[0].index] for i in W]            
        if isinstance(constraint, (list, tuple)):
            W = []; [W.extend(self._map2.get(j<0 and j%n or j,[])) for j in constraint]
            W = [self.words[i-self.words[0].index] for i in W]
            W = unique(W)
        a = []
        i = 0
        while i < len(W):
            w = W[i]
            if w.chunk and W[i:i+len(w.chunk)] == w.chunk.words:
                i += len(w.chunk) - 1
                a.append(w.chunk)
            else:
                a.append(w)
            i += 1
        return a
    
    def __repr__(self):
        return "Match(words=%s)" % repr(self.words)

#from en import Sentence, parse
#s = Sentence(parse("I was looking at the big cat, and the big cat was staring back", lemmata=True))
#p = Pattern.fromstring("(*_look*|)+ (at|)+ (DT|)+ (*big_cat*)+")
#
#def profile():
#    import time
#    t = time.time()
#    for i in range(100):
#        p.search(s)
#    print time.time()-t
#
#import cProfile
##import pstats
#cProfile.run("profile()", "_profile")
#p = pstats.Stats("_profile")
#p.stream = open("_profile", "w")
#p.sort_stats("time").print_stats(30)
#p.stream.close()
#s = open("_profile").read()
#print s
