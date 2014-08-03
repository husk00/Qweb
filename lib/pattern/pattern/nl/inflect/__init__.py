#### PATTERN | NL | INFLECT ##########################################################################
# -*- coding: utf-8 -*-
# Copyright (c) 2010 University of Antwerp, Belgium
# Author: Tom De Smedt <tom@organisms.be>
# License: BSD (see LICENSE.txt for details).

######################################################################################################
# A set of rule-based tools for Dutch word inflection:
# - pluralization and singularization of nouns,
# - conjugation of verbs

import re
import os

try:
    MODULE = os.path.dirname(__file__)
except:
    MODULE = ""

VERB, NOUN, ADJECTIVE, ADVERB = "VB", "NN", "JJ", "RB"
VOWELS = ("a","e","i","o","u")
vowel = lambda ch: ch in VOWELS

# Accuracy (measured on CELEX Dutch morphology word forms):
# 79% pluralize()
# 91% singularize()
# 90% _parse_lemma()
# 88% _parse_lexeme()
# 99% predicative()
# 99% attributive()

#### PLURALIZE ########################################################################################

plural_irregular_en = dict.fromkeys(("dag", "dak", "dal", "pad", "vat", "weg"), True)
plural_irregular_een = dict.fromkeys(("fee", "genie", "idee", "orgie", "ree"), True)
plural_irregular_eren = dict.fromkeys(("blad", "ei", "gelid", "gemoed", "kalf", "kind", "lied", "rad", "rund"), True)
plural_irregular_deren = dict.fromkeys(("hoen", "been"), True)

plural_irregular = {
    "escargot" : "escargots",
      "gedrag" : "gedragingen",
       "gelid" : "gelederen",
       "kaars" : "kaarsen",
       "kleed" : "kleren",
         "koe" : "koeien",
         "lam" : "lammeren",
      "museum" : "museums",
        "stad" : "steden",
       "stoel" : "stoelen",
         "vlo" : "vlooien"
}

def pluralize(word, pos=NOUN, custom={}):
    """ Returns the plural of a given word.
        For example: stad -> steden.
        The custom dictionary is for user-defined replacements.
    """

    if word in custom.keys():
        return custom[word]

    w = word.lower()
    
    if pos == NOUN:
        if w in plural_irregular_en:    # dag => dagen
            return w + "en"
        if w in plural_irregular_een:   # fee => feeën
            return w + u"ën"
        if w in plural_irregular_eren:  # blad => bladeren
            return w + "eren"
        if w in plural_irregular_deren: # been => beenderen
            return w + "deren"
        if w in plural_irregular:
            return plural_irregular[w]
        # Words ending in -icus get -ici: academicus => academici
        if w.endswith("icus"):
            return w[:-2] + "i"
        # Words ending in -s usually get -sen: les => lessen.
        if w.endswith(("es","as","nis","ris","vis")):
            return w + "sen"
        # Words ending in -s usually get -zen: huis => huizen.
        if w.endswith("s") and not w.endswith(("us","ts","mens")):
            return w[:-1] + "zen"
        # Words ending in -f usually get -ven: brief => brieven.
        if w.endswith("f"):
            return w[:-1] + "ven"
        # Words ending in -um get -ums: museum => museums.
        if w.endswith("um"):
            return w + "s"
        # Words ending in unstressed -ee or -ie get -ën: bacterie => bacteriën
        if w.endswith("ie"):
            return w + "s"
        if w.endswith(("ee","ie")):
            return w[:-1] + u"ën"
        # Words ending in -heid get -heden: mogelijkheid => mogelijkheden
        if w.endswith("heid"):
            return w[:-4] + "heden"
        # Words ending in -e -el -em -en -er -ie get -s: broer => broers.
        if w.endswith((u"é","e","el","em","en","er","eu","ie","ue","ui","eau","ah")):
            return w + "s"
        # Words ending in a vowel get 's: auto => auto's.
        if w.endswith(VOWELS) or w.endswith("y") and not w.endswith("e"):
            return w + "'s"
        # Words ending in -or always get -en: motor => motoren.
        if w.endswith("or"):
            return w + "en"
        # Words ending in -ij get -en: boerderij => boerderijen.
        if w.endswith("ij"):
            return w + "en"
        # Words ending in two consonants get -en: hand => handen.
        if len(w) > 1 and not vowel(w[-1]) and not vowel(w[-2]):
            return w + "en"
        # Words ending in one consonant with a short sound: fles => flessen.
        if len(w) > 2 and not vowel(w[-1]) and not vowel(w[-3]):
            return w + w[-1] + "en"
        # Words ending in one consonant with a long sound: raam => ramen.
        if len(w) > 2 and not vowel(w[-1]) and w[-2] == w[-3]:
            return w[:-2] + w[-1] + "en"
        return w + "en"
    
    return w

#### SINGULARIZE ######################################################################################

singular_irregular = dict((v,k) for k,v in plural_irregular.iteritems())

def singularize(word, pos=NOUN, custom={}):

    if word in custom.keys():
        return custom[word]

    w = word.lower()
    
    if pos == NOUN and w in singular_irregular:
        return singular_irregular[w]
    if pos == NOUN and w.endswith((u"ën","en","s","i")):
        # auto's => auto
        if w.endswith("'s"):
            return w[:-2]
        # broers => broer
        if w.endswith("s"):
            return w[:-1]
        # academici => academicus
        if w.endswith("ici"):
            return w[:-1] + "us"
        # feeën => fee
        if w.endswith(u"ën") and w[:-2] in plural_irregular_een:
            return w[:-2]
        # bacteriën => bacterie
        if w.endswith(u"ën"):
            return w[:-2] + "e"
        # mogelijkheden => mogelijkheid
        if w.endswith("heden"):
            return w[:-5] + "heid"
        # artikelen => artikel
        if w.endswith("elen") and not w.endswith("delen"):
            return w[:-2]
        # chinezen => chinees
        if w.endswith("ezen"):
            return w[:-4] + "ees"
        if w.endswith("en"):
            w = w[:-2]
            # ogen => oog
            if w in ("og","om","ur"):
                return w[:-1] + w[-2] + w[-1]
            # hoenderen => hoen
            if w.endswith("der") and w[:-3] in plural_irregular_deren:
                return w[:-3]
            # eieren => ei
            if w.endswith("er") and w[:-2] in plural_irregular_eren:
                return w[:-2]
            # dagen => dag (not daag)
            if w in plural_irregular_en:
                return w
            # huizen => huis
            if w.endswith("z"):
                return w[:-1] + "s"
            # brieven => brief
            if w.endswith("v"):
                return w[:-1] + "f"
             # motoren => motor
            if w.endswith("or"):
                return w
            # flessen => fles
            if len(w) > 1 and not vowel(w[-1]) and w[-1] == w[-2]:
                return w[:-1]
            # baarden => baard
            if len(w) > 1 and not vowel(w[-1]) and not vowel(w[-2]):
                return w
            # boerderijen => boerderij
            if w.endswith("ij"):
                return w
            # idealen => ideaal
            if w.endswith(("eal","ean","eol","ial","ian","iat","iol")):
                return w[:-1] + w[-2] + w[-1]
            # ramen => raam
            if len(w) > 2 and not vowel(w[-1]) and vowel(w[-2]) and not vowel(w[-3]):
                return w[:-1] + w[-2] + w[-1]
            return w
    
    return w

#### VERB CONJUGATION #################################################################################

import sys; sys.path.insert(0, os.path.join(MODULE, "..", ".."))
from en.inflect import Verbs
from en.inflect import \
    INFINITIVE, \
    PRESENT_1ST_PERSON_SINGULAR, \
    PRESENT_2ND_PERSON_SINGULAR, \
    PRESENT_3RD_PERSON_SINGULAR, \
    PRESENT_PLURAL, \
    PRESENT_PARTICIPLE, \
    PAST, \
    PAST_1ST_PERSON_SINGULAR, \
    PAST_2ND_PERSON_SINGULAR, \
    PAST_3RD_PERSON_SINGULAR, \
    PAST_PLURAL, \
    PAST_PARTICIPLE

# Load the pattern.en.Verbs class, with a Dutch lexicon instead.
# Lexicon was trained on CELEX and contains the top 2000 most frequent verbs.
_verbs = VERBS = Verbs(path=os.path.join(MODULE, "verbs.txt"))
conjugate, lemma, lexeme, tenses = \
    _verbs.conjugate, _verbs.lemma, _verbs.lexeme, _verbs.tenses
    
def _parse_lemma(verb):
    """ Returns the base form of the given inflected verb, using a rule-based approach.
    """
    v = verb.lower()
    # Common prefixes: op-bouwen and ver-bouwen inflect like bouwen.
    for prefix in ("aan","be","her","in","ont","op","over","uit","ver"):
        if v.startswith(prefix) and v[len(prefix):] in _verbs._lemmas:
            return prefix + _verbs._lemmas[v[len(prefix):]]
    # Present participle -end: hengelend, knippend.
    if v.endswith("end"):
        b = v[:-3]
    # Past singular -de or -te: hengelde, knipte.
    elif v.endswith(("de","det","te","tet")):
        b = v[:-2]
    # Past plural -den or -ten: hengelden, knipten.
    elif v.endswith(("chten"),):
        b = v[:-2]
    elif v.endswith(("den","ten")) and len(v) > 3 and vowel(v[-4]):
        b = v[:-2]
    elif v.endswith(("den","ten")):
        b = v[:-3]
    # Past participle ge- and -d or -t: gehengeld, geknipt.
    elif v.endswith(("d","t")) and v.startswith("ge"):
        b = v[2:-1]    
    # Present 2nd or 3rd singular: wordt, denkt, snakt, wacht.
    elif v.endswith(("cht"),):
        b = v
    elif v.endswith(("dt","bt","gt","kt","mt","pt","wt","xt","aait","ooit")):
        b = v[:-1]
    elif v.endswith("t") and len(v) > 2 and not vowel(v[-2]):
        b = v[:-1]
    elif v.endswith("en") and len(v) > 3:
        return v
    else:
        b = v
    # hengel => hengelen (and not hengellen)
    if len(b) > 2 and b.endswith(("el","nder","om","tter")) and not vowel(b[-3]):
        pass
    # Long vowel followed by -f or -s: geef => geven.
    elif len(b) > 2 and not vowel(b[-1]) and vowel(b[-2]) and vowel(b[-3])\
      or b.endswith(("ijf", "erf"),):
        if b.endswith("f"): b = b[:-1] + "v"
        if b.endswith("s"): b = b[:-1] + "z"
        if b[-2] == b[-3]: 
            b = b[:-2] + b[-1]
    # Short vowel followed by consonant: snak => snakken.
    elif len(b) > 1 and not vowel(b[-1]) and vowel(b[-2]) and not b.endswith(("er","ig")):
        b = b + b[-1]
    return b + "en"

def _parse_lexeme(verb):
    """ For a regular verb (base form), returns the forms using a rule-based approach.
    """
    v = verb.lower()
    # Stem = infinitive minus -en.
    b = b0 = re.sub("en$", "", v)
    # zweven => zweef, graven => graaf
    if b.endswith("v"): b = b[:-1] + "f"
    if b.endswith("z"): b = b[:-1] + "s"
    # Vowels with a long sound are doubled, we need to guess how it sounds:
    if len(b) > 2 and not vowel(b[-1]) and vowel(b[-2]) and not vowel(b[-3]):
        if not v.endswith(("elen","deren","keren","nderen","tteren")):
            b = b[:-1] + b[-2] + b[-1]
    # pakk => pak
    if len(b) > 1 and not vowel(b[-1]) and b[-1] == b[-2]:
        b = b[:-1]
    # Present tense gets -t:
    sg = not b.endswith("t") and b + "t" or b
    # Past tense ending in a consonant in "xtc-koffieshop" gets -t, otherwise -d:
    dt = b0[-1] in "xtckfshp" and "t" or (not b.endswith("d") and "d" or "")
    # Past tense -e and handle common irregular inflections:
    p = b + dt + "e"
    for suffix, irregular in (("erfde", "ierf"), ("ijfde","eef"), ("ingde","ong"), ("inkte","onk")):
        if p.endswith(suffix):
            p = p[:-len(suffix)] + irregular; break
    # Past participle: ge-:
    pp = re.sub("tt$", "t", "ge" + b + dt)
    pp = pp.startswith(("geop","gein","geaf")) and pp[2:4]+"ge"+pp[4:] or pp # geopstart => opgestart
    pp = pp.startswith(("gever","gebe","gege")) and pp[2:] or pp
    return [v, b, sg, sg, v, b0+"end", p, p, p, b+dt+"en", p, pp]

_verbs.parse_lemma  = _parse_lemma
_verbs.parse_lexeme = _parse_lexeme

#### ATTRIBUTIVE & PREDICATIVE ########################################################################

adjective_attributive = {
    "civiel"  : "civiele",
    "complex" : "complexe",
    "grof"    : "grove",
    "half"    : "halve",
    "luttel"  : "luttele",
    "mobiel"  : "mobiele",
    "parijs"  : "parijse",
    "ruw"     : "ruwe",
    "simpel"  : "simpele",
    "stabiel" : "stabiele",
    "steriel" : "steriele",
    "subtiel" : "subtiele",
    "teer"    : "tere"
}

def attributive(adjective):
    """ For a predicative adjective, returns the attributive form (lowercase).
        In Dutch, the attributive is formed with -e: "fel" => "felle kritiek".
    """
    w = adjective.lower()
    if w in adjective_attributive:
        return adjective_attributive[w]
    if w.endswith("e"):
        return w
    if w.endswith(("er","st")) and len(w) > 4:
        return w + "e"
    if w.endswith("ees"):
        return w[:-2] + w[-1] + "e"
    if w.endswith("el") and len(w) > 2 and not vowel(w[-3]):
        return w + "e"
    if w.endswith("ig"):
        return w + "e"
    if len(w) > 2 and (not vowel(w[-1]) and vowel(w[-2]) and vowel(w[-3]) or w[:-1].endswith("ij")):
        if w.endswith("f"): w = w[:-1] + "v"
        if w.endswith("s"): w = w[:-1] + "z"
        if w[-2] == w[-3]:
            w = w[:-2] + w[-1]
    elif len(w) > 1 and vowel(w[-2]) and w.endswith(tuple("bdfgklmnprst")):
        w = w + w[-1]
    return w + "e"

adjective_predicative = dict((v,k) for k,v in adjective_attributive.iteritems())

def predicative(adjective):
    """ Returns the predicative adjective (lowercase).
        In Dutch, the attributive form preceding a noun is common:
        "rake opmerking" => "raak", "straffe uitspraak" => "straf", "dwaze blik" => "dwaas".
    """
    w = adjective.lower()
    if w in adjective_predicative:
        return adjective_predicative[w]
    if w.endswith("ste"):
        return w[:-1]
    if w.endswith("ere"):
        return w[:-1]
    if w.endswith("bele"):
        return w[:-1]
    if w.endswith("le") and len(w) > 2 and vowel(w[-3]) and not w.endswith(("eule","oele")):
        return w[:-2] + w[-3] + "l"
    if w.endswith("ve") and len(w) > 2 and vowel(w[-3]) and not w.endswith(("euve","oeve","ieve")):
        return w[:-2] + w[-3] + "f"
    if w.endswith("ze") and len(w) > 2 and vowel(w[-3]) and not w.endswith(("euze","oeze","ieze")):
        return w[:-2] + w[-3] + "s"
    if w.endswith("ve"):
        return w[:-2] + "f"
    if w.endswith("ze"):
        return w[:-2] + "s"
    if w.endswith("e") and len(w) > 2:
        if not vowel(w[-2]) and w[-2] == w[-3]:
            return w[:-2]
        if len(w) > 3 and not vowel(w[-2]) and vowel(w[-3]) and w[-3] != "i" and not vowel(w[-4]):
            return w[:-2] + w[-3] + w[-2]
        return w[:-1]
    return w
