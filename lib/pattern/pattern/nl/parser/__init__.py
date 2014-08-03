#### PATTERN | NL | RULE-BASED SHALLOW PARSER ########################################################
# Copyright (c) 2010 University of Antwerp, Belgium
# Authors: Jeroen Geertzen (for Brill-NL), Tom De Smedt <tom@organisms.be>
# License: BSD (see LICENSE.txt for details).
# http://www.clips.ua.ac.be/pages/pattern

######################################################################################################

import re
import os

try: 
    MODULE = os.path.dirname(__file__)
except:
    MODULE = ""

# The tokenizer, chunker and relation finder are inherited from pattern.en.parser.
# The tagger is based on Jeroen Geertzen's Dutch language model:
# http://cosmion.net/jeroen/software/brill_pos/
# Accuracy is reported around 92%, but Pattern scores may vary from Geertzen's original
# due to WOTAN => Penn Treebank mapping etc.
import sys; sys.path.insert(0, os.path.join(MODULE, "..", ".."))
from en.parser import Lexicon
from en.parser import PUNCTUATION, tokenize as _en_tokenize, parse as _en_parse, TaggedString
from en.parser import commandline

#### TOKENIZER #######################################################################################

def tokenize(s, punctuation=PUNCTUATION, abbreviations=["bv.", "blz.", "e.d.", "m.a.w.", "nl."], replace={}):
    # 's in Dutch preceded by a vowel indicates plural ("auto's"): don't replace.
    return _en_tokenize(s, punctuation, abbreviations, replace)
    
_tokenize = tokenize

#### LEMMATIZER ######################################################################################
# Word lemmas using singularization and verb conjugation from the inflect module.

try:
    from nl.inflect import singularize, conjugate, predicative
except:
    singularize = lambda w: w
    conjugate = lambda w,t: w
    predicative = lambda w: w

def lemma(word, pos="NN"):
    if pos == "NNS":
        return singularize(word)
    if pos.startswith(("VB","MD")):
        return conjugate(word, "infinitive") or word
    if pos.startswith("JJ") and word.endswith("e"):
        return predicative(word)
    return word

def find_lemmata(tagged):
    for token in tagged:
        token.append(lemma(token[0].lower(), pos=len(token)>1 and token[1] or None))
    return tagged

#### PARSER ##########################################################################################

# pattern.en.find_tags() has an optional "lexicon" parameter.
# We'll pass the Dutch lexicon to it instead of the default English lexicon:
lexicon = LEXICON = Lexicon()
lexicon.path = os.path.join(MODULE, "Brill_lexicon.txt")
lexicon.lexical_rules.path = os.path.join(MODULE, "Brill_lexical_rules.txt")
lexicon.contextual_rules.path = os.path.join(MODULE, "Brill_contextual_rules.txt")

WOTAN, PENN_TREEBANK = "wotan", "penntreebank"
wotan = {
       "N(": [("eigen,ev","NNP"), ("eigen,mv","NNPS"), ("ev","NN"), ("mv","NNS")],
       "V(": [("ott,3","VBZ"), ("ott","VBP"), ("ovt","VBD"), ("verl_dw","VBN"), ("teg_dw","VBG"), ("inf","VB"), ("hulp","MD")],
     "Adj(": [("stell","JJ"), ("vergr","JJR"), ("overtr","JJS")],
     "Adv(": [("deel_v","RP"), ("gew","RB")],
     "Art(": "DT",
    "Conj(": "CC",
     "Num(": "CD",
    "Prep(": [("voor_inf","TO"), ("", "IN")],
    "Pron(": [("bez","PRP$"), ("","PRP")],
    "Punc(": [("komma",","), ("haak_open","("), ("haak_sluit",")"), ("",".")],
      "Int": "UH",
     "Misc": [("symbool","SYM")]
}

def wotan2penntreebank(tag, default="NN"):
    """ Converts a WOTAN tag to Penn Treebank II tag.
        For example: bokkenrijders N(soort,mv,neut) => bokkenrijders/NNS
    """
    for k,v in wotan.iteritems():
        if tag.startswith(k):
            if not isinstance(v, list):
                return v
            for a,b in v:
                if a in tag: return b
            return tag
    return tag

def parse(s, tokenize=True, tags=True, chunks=True, relations=False, lemmata=False, encoding="utf-8", **kwargs):
    """ Takes a string (sentences) and returns a tagged Unicode string. 
        Sentences in the output are separated by newlines.
    """
    if tokenize:
        s = [s.split(" ") for s in _tokenize(s)]
    # Reuse the English parser:
    kwargs.update({
        "lemmata": False,
          "light": False,
        "lexicon": LEXICON,
            "map": kwargs.get("tagset","").lower() != WOTAN and wotan2penntreebank or None,
       "language": "nl"
    })
    s = _en_parse(s, False, tags, chunks, relations, **kwargs)
    if lemmata:
        p = [find_lemmata(sentence) for sentence in s.split()]
        p = "\n".join([" ".join(["/".join(token) for token in sentence]) for sentence in p])
        s = TaggedString(p, tags=s.tags+["lemma"], language="nl")
    return s

def tag(s, tokenize=True, encoding="utf-8"):
    """ Returns a list of (token, tag)-tuples from the given string.
    """
    tags = []
    for sentence in parse(s, tokenize, True, False, False, False, encoding).split():
        for token in sentence:
            tags.append((token[0], token[1]))
    return tags

#### COMMAND LINE ####################################################################################
# From the folder that contains the "pattern" folder:
# python -m pattern.nl.parser xml -s "De kat wil wel vis eten maar geen poot nat maken." -OTCLI

if __name__ == "__main__":
    commandline(parse)