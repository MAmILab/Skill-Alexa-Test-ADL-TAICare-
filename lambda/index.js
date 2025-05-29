/* eslint-disable  func-names */
/* eslint-disable  no-console */
/* eslint-disable  no-restricted-syntax */

// IMPORTANT: Please note that this template uses Dispay Directives,
// Display Interface for your skill should be enabled through the Amazon developer console
// See this screenshot - https://alexa.design/enabledisplay

const Alexa = require('ask-sdk-core');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const languageStrings = require('./resources');
const mongodb = require("mongo_util");
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
require('dayjs/locale/es');
require('dayjs/locale/en');
dayjs.extend(relativeTime);



/* ======================================INTENT HANDLERS======================================= */

/**
 * SKILL INVOCATION
 * 
 * speaks the welcome message
 **/
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === `LaunchRequest`;
  },
  handle(handlerInput) {
    //mongodb.run();
    return handlerInput.responseBuilder
      .speak(handlerInput.attributesManager.getRequestAttributes().t('WELCOME_MESSAGE'))
      .reprompt(handlerInput.attributesManager.getRequestAttributes().t('HELP_MESSAGE'))
      .getResponse();
  },
};

/**
 * SKILL INIT
 * 
 * initializes all session attributes and asks the first question, state change to "quiz"
 **/
const QuizHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    console.log("Inside QuizHandler");
    console.log(JSON.stringify(request));
    return request.type === "IntentRequest" &&
           (request.intent.name === "QuizIntent" || request.intent.name === "AMAZON.StartOverIntent");
  },
  async handle(handlerInput) {
    console.log("Inside QuizHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;
    attributes.state = states.QUIZ;
    attributes.counter = 0;
    attributes.quizScore = 0;
    attributes.badlFlag = false; // flag indicating independence at first sight to continue with more IADL questions or pass to BADL in case of poorer independence
    attributes.answers = [];

    var requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    var question = await askQuestion(handlerInput);
    var speakOutput = requestAttributes.t('START_QUIZ_MESSAGE') + question;
    var repromptOutput = question;
    //console.log("########### Inside QuizHandler ############: "+ speakOutput);
    if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']){//supportsDisplay(handlerInput)) {
      const title = `Question #${attributes.counter}`;
      //const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getQuestionWithoutOrdinal(handlerInput,attributes.counter)).getTextContent();
      //const backgroundImage = new Alexa.ImageHelper().addImageInstance(getBackgroundImage('AL')).getImage();
      response.addDirective({
                                "type": "Alexa.Presentation.APL.RenderDocument",
                                "token": "documentToken",
                                "document": {
                                    "src": "doc://alexa/apl/documents/question1",
                                    "type": "Link"
                                },
                                "datasources": {
                                    "multipleChoiceTemplateData": {
                                        "type": "object",
                                        "properties": {
                                            "backgroundImage": backgroundImagePath,
                                            "titleText": title ,
                                            "primaryText": question,
                                            "choices": requestAttributes.t('ITEM_LIST'),
                                            "choiceListType": "number",
                                            "footerHintText": requestAttributes.t('FOOTER_HINT')
                                        }
                                    }
                                }
                            });
    }
    console.log("########### Inside QuizHandler ############: "+ speakOutput);
    return response.speak(speakOutput)
                   .reprompt(repromptOutput)
                   .getResponse();
  },
};


/**
 * QUIZ ANSWER
 * 
 * extract information from user answer, control the flow of the quiz and ask new question
 **/
const QuizAnswerHandler = {
  canHandle(handlerInput) {
    console.log("Inside QuizAnswerHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return attributes.state === states.QUIZ &&
           request.type === 'IntentRequest' &&
           request.intent.name === 'AnswerIntent';
  },
  async handle(handlerInput) {
    const locale = handlerInput.requestEnvelope.request.locale;
    const lang = locale.startsWith('es') ? 'es' : 'en';
    console.log("Inside QuizAnswerHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;

    var speakOutput = ``;
    var repromptOutput = ``;
    
    //========= obtain score from slots ==============//
    
    const scoreSlot = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Score');
    const appreciationSlot = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Appreciation');
    
    let score = null;
    if (scoreSlot) {
      score = parseInt(scoreSlot);
    } else if (appreciationSlot) {
      const cleaned = appreciationSlot.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      score = appreciationMap[lang][cleaned];
    }

    if (!score || score < 1 || score > 4) {
      const speakOutput = lang === 'es'
        ? "Lo siento, no entendí tu respuesta. Por favor, responde con un número del uno al cuatro o con frases como 'me cuesta' o 'sin problemas'."
        : "Sorry, I didn't understand your answer. Please respond with a number between one and four, or say things like 'I struggle' or 'I can'.";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
    score = getScore(score);
    //const score = compareSlots(handlerInput.requestEnvelope.request.intent.slots);
    //============= evaluate the flow of the quiz ==============//
    attributes.answers[attributes.counter-1]=score;
    if (score >= 1) {
      speakOutput = getSpeechCon(true);
      attributes.quizScore += score;
    } else {
      speakOutput = getSpeechCon(false);
    }
    if (attributes.quizScore < 3 && attributes.counter === 2){
        attributes.badlFlag = true;
    }
    handlerInput.attributesManager.setSessionAttributes(attributes);
    var question = ``;
    if (attributes.counter < 6) {
      speakOutput += getCurrentScore(handlerInput,attributes.quizScore, attributes.counter*2);
      question = await askQuestion(handlerInput);
      speakOutput += question;
      repromptOutput = question;

      if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
        var requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const title = `Question #${attributes.counter}`;
        //const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getQuestionWithoutOrdinal(handlerInput,attributes.counter)).getTextContent();
        //const backgroundImage = new Alexa.ImageHelper().addImageInstance(getBackgroundImage('AL')).getImage();
        response.addDirective({
                                "type": "Alexa.Presentation.APL.RenderDocument",
                                "token": "documentToken",
                                "document": {
                                    "src": "doc://alexa/apl/documents/question1",
                                    "type": "Link"
                                },
                                "datasources": {
                                    "multipleChoiceTemplateData": {
                                        "type": "object",
                                        "properties": {
                                            "backgroundImage": backgroundImagePath,
                                            "titleText": title ,
                                            "primaryText": question,
                                            "choices": requestAttributes.t('ITEM_LIST'),
                                            "choiceListType": "number",
                                            "footerHintText": requestAttributes.t('FOOTER_HINT')
                                        }
                                    }
                                }
        });
      }
      return response.speak(speakOutput)
      .reprompt(repromptOutput)
      .getResponse();
    }
    else {
        const d = new Date();
        let timestamp = d.toISOString();
        const result = {
            "score" : attributes.quizScore,
            "iadl_only" : !attributes.badlFlag,
            "answers" : attributes.answers,
            "time" : d,
            "iadls" : ["shopping","meal_prep"]
        }
        mongodb.insertQuizResult(result);
        speakOutput += getFinalScore(handlerInput,attributes.quizScore, attributes.counter*2) + " Los parciales son "+ attributes.answers + " . " + handlerInput.attributesManager.getRequestAttributes().t('EXIT_SKILL_MESSAGE');
        if(supportsDisplay(handlerInput)) {
            const title = 'Thank you for playing';
            const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getFinalScore(handlerInput,attributes.quizScore, attributes.counter)).getTextContent();
            response.addRenderTemplateDirective({
                type : 'BodyTemplate1',
                backButton: 'hidden',
                title,
                textContent: primaryText,
            });
        }
        return response.speak(speakOutput).getResponse();
    }
  },
};

//===================================OTHER HANDLERS===============================================

const RepeatHandler = {
  canHandle(handlerInput) {
    console.log("Inside RepeatHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return attributes.state === states.QUIZ &&
           request.type === 'IntentRequest' &&
           request.intent.name === 'AMAZON.RepeatHandler';
  },
  handle(handlerInput) {
    console.log("Inside RepeatHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const question = attributes.currentQuestion;

    return handlerInput.responseBuilder
      .speak(question)
      .reprompt(question)
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    console.log("Inside HelpHandler");
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
           request.intent.name === 'AMAZON.HelpHandler';
  },
  handle(handlerInput) {
    console.log("Inside HelpHandler - handle");
    return handlerInput.responseBuilder
      .speak(handlerInput.attributesManager.getRequestAttributes().t('HELP_MESSAGE'))
      .reprompt(handlerInput.attributesManager.getRequestAttributes().t('HELP_MESSAGE'))
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    console.log("Inside ExitHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return request.type === `IntentRequest` && (
              request.intent.name === 'AMAZON.StopIntent' ||
              request.intent.name === 'AMAZON.PauseIntent' ||
              request.intent.name === 'AMAZON.CancelIntent'
           );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(handlerInput.attributesManager.getRequestAttributes().t('EXIT_SKILL_MESSAGE'))
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log("Inside SessionEndedRequestHandler");
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    console.log("Inside ErrorHandler");
    return true;
  },
  handle(handlerInput, error) {
    console.log("Inside ErrorHandler - handle");
    console.log(`Error handled: ${JSON.stringify(error)}`);
    console.log(`Handler Input: ${JSON.stringify(handlerInput)}`);

    return handlerInput.responseBuilder
      .speak(handlerInput.attributesManager.getRequestAttributes().t('HELP_MESSAGE'))
      .reprompt(handlerInput.attributesManager.getRequestAttributes().t('HELP_MESSAGE'))
      .getResponse();
  },
};

const LocalizationInterceptor = {
  process(handlerInput) {
    // Gets the locale from the request and initializes 
    // i18next.
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      resources: languageStrings,
    });
    // Creates a localize function to support arguments.
    localizationClient.localize = function localize() {
      // gets arguments through and passes them to
      // i18next using sprintf to replace string placeholders
      // with arguments.
      const args = arguments;
      const values = [];
      for (let i = 1; i < args.length; i += 1) {
        values.push(args[i]);
      }
      const value = i18n.t(args[0], {
        returnObjects: true,
        postProcess: 'sprintf',
        sprintf: values,
      });

      // If an array is used then a random value is selected 
      if (Array.isArray(value)) {
        return value[Math.floor(Math.random() * value.length)];
      }
      return value;
    };
    // this gets the request attributes and save the localize function inside 
    // it to be used in a handler by calling requestAttributes.t(STRING_ID, [args...])
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function translate(...args) {
      return localizationClient.localize(...args);
    };
  },
};

/* ====================================CONSTANTS======================================== */
const skillBuilder = Alexa.SkillBuilders.custom();
const imagePath = "https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/tutorials/quiz-game/state_flag/{0}x{1}/{2}._TTH_.png";
const backgroundImagePath = "https://d2o906d8ln7ui1.cloudfront.net/images/response_builder/background-green.png"
const speechConsCorrect = ['¡Bien!', '¡Genial!', '¡Estupendo!', '¡Eso está muy bien!', '¡Perfecto!'];
const speechConsWrong = ['Que mal', 'Vaya...', 'Bueno'];
                //https://raw.githubusercontent.com/apvereda/rcis18-GeoJSON-City-Malaga/refs/heads/master/ratings/muytriste.png",
                //"https://raw.githubusercontent.com/apvereda/rcis18-GeoJSON-City-Malaga/refs/heads/master/ratings/triste.png",
                //"https://raw.githubusercontent.com/apvereda/rcis18-GeoJSON-City-Malaga/refs/heads/master/ratings/medio.png",
                //"https://raw.githubusercontent.com/apvereda/rcis18-GeoJSON-City-Malaga/refs/heads/master/ratings/feliz.png",
                //"https://raw.githubusercontent.com/apvereda/rcis18-GeoJSON-City-Malaga/refs/heads/master/ratings/muyfeliz.png"];
const states = {
  START: `_START`,
  QUIZ: `_QUIZ`,
};

const useCardsFlag = true;

const appreciationMap = {
  'es': {
    "no puedo": 1,
    "ni hablar": 1,
    "ni de broma": 1,
    "es imposible": 1,
    "no soy capaz": 1,
    "de ninguna manera": 1,
    "me resulta imposible": 1,
    "no lo consigo": 1,
    "no lo puedo hacer": 1,

    "necesito ayuda": 2,
    "me ayuda alguien": 2,
    "no lo hago solo": 2,
    "con ayuda si": 2,
    "alguien me asiste": 2,
    "me tienen que ayudar": 2,
    "dependo de alguien": 2,
    "con asistencia": 2,

    "me cuesta": 3,
    "es un poco dificil": 3,
    "requiere esfuerzo": 3,
    "me las veo": 3,
    "lo hago pero con dificultad": 3,
    "con algo de esfuerzo": 3,
    "me cuesta un poco": 3,
    "no es fácil para mi": 3,

    "puedo solo": 4,
    "sin problemas": 4,
    "no tengo problema": 4,
    "lo hago sin dificultad": 4,
    "me las arreglo": 4,
    "lo hago solo": 4,
    "por mi cuenta": 4,
    "sin ayuda": 4
  },
  'en': {
    "i can't": 1,
    "i cannot": 1,
    "no way": 1,
    "not able": 1,
    "it's impossible": 1,
    "i can't do it": 1,

    "i need help": 2,
    "i can't do it alone": 2,
    "someone helps me": 2,
    "i get assistance": 2,
    "i depend on someone": 2,
    "with help": 2,

    "i struggle": 3,
    "it's a bit hard": 3,
    "i manage but it's hard": 3,
    "takes effort": 3,
    "i'm struggling": 3,
    "it's not easy": 3,

    "i can": 4,
    "i do it alone": 4,
    "i'm fine": 4,
    "i do it myself": 4,
    "i can do it without help": 4,
    "no problem": 4
  }
};

/* ===============================HELPER FUNCTIONS========================================= */

// returns true if the skill is running on a device with a display (show|spot)
function supportsDisplay(handlerInput) {
  var hasDisplay =
    handlerInput.requestEnvelope.context &&
    handlerInput.requestEnvelope.context.System &&
    handlerInput.requestEnvelope.context.System.device &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display
  return hasDisplay;
}

function getCurrentScore(handlerInput,score, counter) {
  return handlerInput.attributesManager.getRequestAttributes().t('CURRENT_SCORE',score,counter);
}

function getFinalScore(handlerInput,score, counter) {
  return handlerInput.attributesManager.getRequestAttributes().t('FINAL_SCORE',score,counter);
}

function getSmallImage(item) {
  return `https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/tutorials/quiz-game/state_flag/720x400/AL._TTH_.png`;
}

function getLargeImage(item) {
  return `https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/tutorials/quiz-game/state_flag/1200x800/AL._TTH_.png`;
}

function getImage(height, width, label) {
  return imagePath.replace("{0}", height)
    .replace("{1}", width)
    .replace("{2}", label);
}

function getBackgroundImage(label, height = 1024, width = 600) {
    return backgroundImagePath.replace("{0}", height)
    .replace("{1}", width)
    .replace("{2}", label);
}

function formatCasing(key) {
    return key.split(/(?=[A-Z])/).join(' ');
}

function getBADLQuestion(handlerInput, counter) { 
    return handlerInput.attributesManager.getRequestAttributes().t(`QUESTION`,counter+1) + 
        handlerInput.attributesManager.getRequestAttributes().t(`QUESTION_BADL_`+(counter+1));
}

async function getIADLQuestion(handlerInput,counter){
    const locale = handlerInput.requestEnvelope.request.locale;
    dayjs.locale(locale.startsWith('es') ? 'es' : 'en');
    var question = '';
    var adl = '';
    switch(counter){
        case 0:
            adl = "shopping";
            break;
        case 1:
            adl = "meal_prep";
            break;
        case 2:
            adl = "laundry";
            break;
        case 3:
            adl = "house_keeping";
            break;
        case 4:
            adl = "medication_use";
            break;
        case 5:
            adl = "entertainment";
            break;
    }
    console.log("voy a buscar anomalias");
    var anomaly = await mongodb.getAnomalies(adl);
    console.log("Resultado de anomaly:", anomaly);
    if(anomaly !== null){
        // get adl translate
        adl = handlerInput.attributesManager.getRequestAttributes().t(adl.toUpperCase());
        // get time
        var time = dayjs(anomaly[0].date).fromNow();
        question = handlerInput.attributesManager.getRequestAttributes().t(`QUESTION_IADL_ATTR`,adl,time);
    } else {
        question = handlerInput.attributesManager.getRequestAttributes().t(`QUESTION_IADL_`+(counter+1));
    }
    //console.log(mongodb.getAnomalies(adl));
    //question = handlerInput.attributesManager.getRequestAttributes().t(`QUESTION_IADL_ATTR`,adl,time);
    //else
    //question = handlerInput.attributesManager.getRequestAttributes().t(`QUESTION_IADL_`+(counter+1));
    
    return handlerInput.attributesManager.getRequestAttributes().t(`QUESTION`,counter+1) + question;
}

function getRandom(min, max) {
  return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

async function askQuestion(handlerInput) {
    console.log("I am in askQuestion()");
    //GET SESSION ATTRIBUTES
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    var question="";
    //SET QUESTION DATA TO ATTRIBUTES
    if (attributes.badlFlag){
        // buscar preguntas en la base de datos
        question = getBADLQuestion(handlerInput, attributes.counter); 
    } else {
        question = await getIADLQuestion(handlerInput, attributes.counter);
    }
    attributes.currentQuestion = question;
    attributes.counter += 1;
    //SAVE ATTRIBUTES
    handlerInput.attributesManager.setSessionAttributes(attributes);
    
    return question;
}

function compareSlots(slots) {
    for (const slot in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
            if (slots[slot].name.toString().toLowerCase() === "score" && parseInt(slots[slot].value) <= 1) { //toString().toLowerCase() <= 1) {
                return 0;
            } else if (slots[slot].name.toString().toLowerCase() === "score" && slots[slot].value === "2" || slots[slot].value === "3") {
                return 1;
            } else if (slots[slot].name.toString().toLowerCase() === "score" && parseInt(slots[slot].value) >= 4) {
                return 2;
            }
        }
    }
}

function getScore(score) {
        if (score !== undefined) {
            if (score <= 1) { //toString().toLowerCase() <= 1) {
                return 0;
            } else if (score === "2" || score === "3") {
                return 1;
            } else if (score >= 4) {
                return 2;
            }
        }
}

function getSpeechCon(type) {
    if (type) return `<say-as interpret-as='interjection'>${speechConsCorrect[getRandom(0, speechConsCorrect.length - 1)]} </say-as><break strength='strong'/>`;
    return `<say-as interpret-as='interjection'>${speechConsWrong[getRandom(0, speechConsWrong.length - 1)]} </say-as><break strength='strong'/>`;
}

/*function getItem(slots) {
  const propertyArray = Object.getOwnPropertyNames(data[0]);
  let slotValue;

  for (const slot in slots) {
    if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
      slotValue = slots[slot].value;
      for (const property in propertyArray) {
        if (Object.prototype.hasOwnProperty.call(propertyArray, property)) {
          const item = data.filter(x => x[propertyArray[property]]
            .toString().toLowerCase() === slots[slot].value.toString().toLowerCase());
          if (item.length > 0) {
            return item[0];
          }
        }
      }
    }
  }
  return slotValue;
}*/
/*function getTextDescription(item) {
  let text = '';

  for (const key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      text += `${formatCasing(key)}: ${item[key]}\n`;
    }
  }
  return text;
}*/

/*function getAndShuffleMultipleChoiceAnswers(currentIndex, item, property) {
  return shuffle(getMultipleChoiceAnswers(currentIndex, item, property));
}

// This function randomly chooses 3 answers 2 incorrect and 1 correct answer to
// display on the screen using the ListTemplate. It ensures that the list is unique.
function getMultipleChoiceAnswers(currentIndex, item, property) {

  // insert the correct answer first
  let answerList = [item[property]];

  // There's a possibility that we might get duplicate answers
  // 8 states were founded in 1788
  // 4 states were founded in 1889
  // 3 states were founded in 1787
  // to prevent duplicates we need avoid index collisions and take a sample of
  // 8 + 4 + 1 = 13 answers (it's not 8+4+3 because later we take the unique
  // we only need the minimum.)
  let count = 0
  let upperBound = 12

  let seen = new Array();
  seen[currentIndex] = 1;

  while (count < upperBound) {
    let random = getRandom(0, data.length - 1);

    // only add if we haven't seen this index
    if ( seen[random] === undefined ) {
      answerList.push(data[random][property]);
      count++;
    }
  }

  // remove duplicates from the list.
  answerList = answerList.filter((v, i, a) => a.indexOf(v) === i)
  // take the first three items from the list.
  answerList = answerList.slice(0, 3);
  return answerList;
}

// This function takes the contents of an array and randomly shuffles it.
function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  while ( 0 !== currentIndex ) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}*/

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    QuizHandler,
    QuizAnswerHandler,
    RepeatHandler,
    HelpHandler,
    ExitHandler,
    SessionEndedRequestHandler
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
