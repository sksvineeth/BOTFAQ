var builder = require('botbuilder');
var restify = require('restify');
var fs = require('fs');
var https = require('https');
var resemble = require('node-resemble-js');
var tmp = require('tmp');
//var cognitiveservices = require('botbuilder-cognitiveservices');
//var qa = require('qa');


var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
/*var  recognizer = new cognitiveservices.QnAMakerRecognizer({
	knowledgeBaseId: '9c0ef106-fe80-4bc2-bfba-0f3552d2d7dd', 
	subscriptionKey: ' 9918e6b35ba340c69d1333920ad4de30'});

var BasicQnAMakerDialog = new cognitiveservices.QnAMakerDialog({ 
	recognizers: [recognizer],
	defaultMessage: 'No good match in FAQ.',
	qnaThreshold: 0.3});
/*var model ='https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/026aec1e-f977-4af8-996d-320fb47a34dc?subscription-key=e096c35b904d4308a60cc79eb6778fa2&timezoneOffset=0&verbose=true'; //process.env.LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);
var intents = new builder.IntentDialog({
    recognizers: [recognizer]
});*/


var bot = new builder.UniversalBot(connector);
 //bot.dialog('/', BasicQnAMakerDialog);
bot.dialog('/', [
    function (session) {
        builder.Prompts.choice(session,'What can I help you with?', ['FAQ', 'Help'] );
    },
    function (session, results) {
         if (results.response.entity === 'FAQ') {
	      //var fit= new qa.q(session)
		  session.beginDialog('/Help');
	     //session.beginDialog('/',BasicQnAMakerDialog);
        } else if (results.response.entity === 'Help') {
			session.beginDialog('/Help');
			//bot.Dialog('/',BasicQnAMakerDialog);
            
        } else {
			
            session.send('Invalid choice.');
            session.endDialog();
			
           // session.beginDialog('/BasicQnAMakerDialog');
        }
    }
]);

//&q=


//bot.dialog('/', intents);
//bot.dialog('/', BasicQnAMakerDialog);
bot.dialog('/Help', [function (session) {
        session.sendTyping();
        builder.Prompts.choice(session, 'What can I help you with?', ['Sketch of the doc', 'Detailed Description']);
    },
    function (session, results) {
        if (results.response.entity === 'Sketch of the doc') {
            session.replaceDialog('/Vessel');
        } else if (results.response.entity === 'Detailed Description') {
			
            session.replaceDialog('/Exchanger');
        } else {
            session.send('Invalid choice.');
            session.endDialog();
			
           // session.beginDialog('/BasicQnAMakerDialog');
        }
    }
]);
/*
var recognizer = new cognitiveservices.QnAMakerRecognizer({
	knowledgeBaseId: '9c0ef106-fe80-4bc2-bfba-0f3552d2d7dd', 
	subscriptionKey: ' 9918e6b35ba340c69d1333920ad4de30'});
	
var basicQnAMakerDialog = new cognitiveservices.QnAMakerDialog({
	recognizers: [recognizer],
	defaultMessage: 'No match! Try changing the query terms!',
	qnaThreshold: 0.3
});
bot.dialog('/FA',  [

        function (session, args, next) {
      session.beginDialog('/',basicQnAMakerDialog);
	  return
    }
       

]);
*/
bot.dialog('/IdentifyProduct', [
 
    function (session, results, next) {
        if (session.privateConversationData.category) {
			session.dialogData.uploadingImage = 'No';
            next();
            return;
        }
        
            builder.Prompts.choice(session, 'Please choose type of the section.', productCategories);
        
    },
    function (session, results, next) {
        var product = session.privateConversationData.category || results.response.entity;

        var category = productCategories[product];
        if (!category) {
            session.send('No match found.');
            session.replaceDialog('/IdentifyProduct');
            return;
        }
        session.privateConversationData.category = product;
        var subcategories = category.SubCategories.map(function (item) {
            return item.name;
        });
        builder.Prompts.choice(session, category.SubCategoriesPrompt, subcategories);
    },
    function (session, results, next) {
        var category = productCategories[session.dialogData.category];
        session.privateConversationData.subCategory = results.response.entity;

        session.endDialog();
    }
]);
bot.dialog('/Exchanger', [
    function (session, args, next) {
        session.beginDialog('/IdentifyProduct');
    },
    function (session, results, next) {
        if (session.privateConversationData.productName) {
            next();
            return;
        }
        var category = productCategories[session.privateConversationData.category];
        var subCategory = category.SubCategories.find(function (item) {
            return item.name === session.privateConversationData.subCategory;
        });
        var productNames = [];
        var cards = subCategory.products.map(function (p) {
            productNames.push(p.name);
            return new builder.HeroCard(session)
                .title(p.name)
                .images([
                    builder.CardImage.create(session, p.image)
                    .tap(builder.CardAction.showImage(session, p.image)),
                ])
                .buttons([builder.CardAction.imBack(session, p.name, "Select")]);
        });

        var msg = new builder.Message(session).attachmentLayout(builder.AttachmentLayout.carousel)
            .text('Please select the displayed tab which you want to know in detail.')
            .attachments(cards);
        builder.Prompts.choice(session, msg, productNames);
    },
    function (session, results) {
        var category = productCategories[session.privateConversationData.category];
        var subCategory = category.SubCategories.find(function (item) {
            return item.name === session.privateConversationData.subCategory;
        });
        var productName = session.privateConversationData.productName || results.response.entity;
        var product = subCategory.products.find(function (p) {
            return p.name === productName;
        });
        session.privateConversationData.productInfo = product;
        session.send('Here are the attributes in the selected tab ' + productName);
        session.endDialog();
        session.beginDialog('/Steps');
    }
]);

bot.dialog('/Steps', [
    function (session) {
        session.sendTyping();
        if (!session.privateConversationData.currentStep) {
            session.privateConversationData.currentStep = 0;
        }
        if (session.privateConversationData.currentStep <= session.privateConversationData.productInfo.install.length - 1) {
            session.send(session.privateConversationData.productInfo.install[session.privateConversationData.currentStep++]);
            builder.Prompts.choice(session, 'Next attribute?', ['Yes','no']);
        } else {
            session.send('You are done with the attributes');
            session.privateConversationData.currentStep = null;
            session.endDialog();
            session.endConversation();
            session.beginDialog('/Help');
        }
    },
    function (session, results) {
		if(results.response.entity=='Yes'){
        session.replaceDialog('/Steps');
		}
		else{
			session.beginDialog('/Help');
    }
	}
]);

bot.dialog('/Vessel', [
    function (session, args, next) {
        session.beginDialog('/IdentifyProduct');
    },
    function (session, results, next) {
        if (session.privateConversationData.productName) {
            session.send("Found your product.");
            var card = new builder.Message(session)
                .attachments([new builder.HeroCard(session)
                    .title(session.privateConversationData.productName)
                    .images([
                        builder.CardImage.create(session, session.privateConversationData.productImage)
                    ])
                ]);
            session.endConversation(card);
            session.beginDialog('/Help');
        } else {
            var category = productCategories[session.privateConversationData.category];
            var subCategory = category.SubCategories.find(function (item) {
                return item.name === session.privateConversationData.subCategory;
            });

            var cards = subCategory.products.map(function (p) {
                return new builder.HeroCard(session)
                    .title(p.name)
                    .images([
                        builder.CardImage.create(session, p.image)
                        .tap(builder.CardAction.showImage(session, p.image)),
                    ]);
            });

            var msg = new builder.Message(session).attachmentLayout(builder.AttachmentLayout.carousel)
                .text('Sketch of the sections')
                .attachments(cards);
            session.endConversation(msg);
            session.beginDialog('/Help');
        }
    }
]);

var productCategories = {
    'Vessel': {
        'SubCategoriesPrompt': 'Which tab you want in detail',
        'SubCategories': [{
            name: 'General Tab',
            products: [{
                name: 'General Tab',
                image: 'http://teams.honeywell.com/sites/341061/Bot/Vesselgt1.PNG',
                localImage: 'Vesselgt1.png',
                install: [
                    'Customer Tag -             This value is locked and can only be changed in the 112 Tool.',
                    'Description-                  This value is locked and can only be changed in the 112 Tool.',
					'Number of Ports-               Minimum is 3.',
					'Minimum Liquid Level Above Bottom Nozzle-                  Used for all flow scenarios and all process cases in the hydraulic analysis.This is the minimum liquid level above the bottom nozzle not the bottom tangent line.For receivers with a boot, enter the boot tangent length plus the minimum liquid level in the main part of the receiver',
					'Vessel Liquid Full-                      Check this box if the vessel is liquid full.The hydraulics program will automatically set the vessel liquid level to the same value as the top nozzle elevation.',
					'Actual Elevation-                        UOP Hydraulics does not automatically elevate the vessel; the engineer must enter this value manually.  For revamps, enter the existing skirt height.Enter the value in full precision:1)Copy/paste the value from the unit converter tool 2)Change the input units to metric in order to enter the value',
					'Min. Mech Skirt Height-                  This is the minimum mechanical clearance that the UOP Vessel Design program calculated for columns.'
                ]
            } 
           ]
        }, {
            name: 'Vessel tab',
            products: [{
                name: 'Vessel tab',
                image: 'http://teams.honeywell.com/sites/341061/Bot/Vesselvt1.PNG',
                localImage: 'Image 5.jpg',
                install: [
                     'Relative Elevation -         This is the elevation above or below the skirt height elevation.  For a vertical vessel, this is the elevation of the nozzle above the vessel bottom tangent line.  For a horizontal vessel, it is the elevation above or below the bottom of the shell.Nozzles on the bottom head are regarded as being at the vessel tangent line, which means they are given a relative elevation of zero.  Because boots on vessels extend below the bottom tangent line or vessel, relative elevations for nozzles on boots will be negative numbers. DO NOT LIST ANY 2 NOZZLES AT AN ELEVATION OF 0.  If there are any nozzles in the vessel form that are not connected to any pipes or are not being used, always move these nozzles to the top of the vessel above all other nozzles.These values are automatically imported from ABE by doing one of the following•	Click the “Import Port Relative Elevations” button on the vessel form to import the elevations for that vessel only •	From the Explorer, right click on “Vessels” and select “Import Mechanical Data” to import the elevations for all vessels If any nozzle elevations are manually entered, the font will turn blue.  When importing data from ABE, the values will not get overwritten.  If you do want to remove the manually entered values and import the values from ABE, press the “Clear Manual Port Relative Elevations” button.  Import the relative nozzle elevations from ABE ',
                    'Internals Section DP -	    This is input of the Normal flow scenario pressure drop for the governing case. If the vessel is downflow, enter the pressure drop with a negative sign.',
                    'Controlled Pressure	Enter the controlled pressure for the port that is controlled.  If entering the value in this field, all process cases and flow scenarios will have the same value.  If you want to enter different values, click on the field once and then click the button with …',
				    'Pressure at Port    -	•	If the vessel does not have a controlled pressure, then rerun the first vessel circuit to recalculate the port pressures every time after changing the nozzle elevations, entering liquid levels, entering the section pressure drop or adding a port.•	If the vessel has a controlled pressure, then the port pressures can be updated by pressing the Calculate button.•	The bottom port pressure is equal to the top port pressure plus the total vessel frictional pressure drop (all sections) plus the static head associated with the minimum liquid level.',
				    'Pressure at Port based on Add’l LL	         -This is the pressure at the port based on the additional liquid level that was entered for this corresponding port.  This value is independent from other ports.',
            		'Section Min Liquid Level/Port Add’      -l Liquid Level	Enter a value if you want a maximum liquid level to be used for a particular port in a circuit.  This can be for an inlet or outlet port.',
			       'Section Density	        -If you do not want the static head in a particular vessel section to be calculated with the section inlet stream or outlet stream density, then you can manually select a different stream to reference or manually enter a density.'
                ]
            },
           {
                name: 'Vessel tab2',
                image: 'http://teams.honeywell.com/sites/341061/Bot/vt2.PNG',
                localImage: 'Image 5.jpg',
                install: [
				  'Rating Method within Cases  -	Default is constant DP Use the combo box to ensure that all sections have the same selection.Reactors/Recycle Gas Scrubber/Offgas Amine Scrubber:  If the pressure drop is not constant for all cases, change to Mass**2/density, Visc** 0.2.',
                    'Rating Method across Cases -	Default is constant DP Use the combo box to ensure that all sections have the same selection.Reactors/Recycle Gas Scrubber/Offgas Amine Scrubber:  If the pressure drop is not constant for all cases, change to Mass**2/density, Visc** 0.2.',
                   
                   
			]
		   }
			
			
			
			]
        }],

    },
    'Exchanger': {
        'SubCategoriesPrompt': 'Please choose what tab you want in detail?',
        'SubCategories': [{
            name: 'General Tab',
            products: [{
                name: 'General Tab',
                image: 'http://teams.honeywell.com/sites/341061/Bot/Exchangersgt1.PNG' ,
                install: [
                    'Customer Tag	- This value is locked and can only be changed in the 112 Tool.',
					'Description -	This value is locked and can only be changed in the 112 Tool.',
					'Elevation	- The value is automatically set to 40 ft for air coolers.  The value is automatically calculated for horizontal reboilers.',
                    'Side	- This value is locked and can only be changed in the Simloader.'
				]
            } ]
        }, {
            name: 'Pressure Tab',
            products: [{
                name: 'Pressure Tab',
                image: 'http://teams.honeywell.com/sites/341061/Bot/Exchangerspt1.PNG',
                localImage: 'Image 10.jpg',
                install: [
                    'Maximum Allowable Pressure Drop -This is input of the Normal flow scenario pressure drop for the governing case.If “Set Equipment Attributes” is selected in UOP Hydraulics, UOP Hydraulics will automatically enter the normal pressure drop from the ABE (simulation).  The program does not know the number of shells nor have the appropriate information to estimate the pressure drop per shell.  If the value from the ABE is incorrect, manually overwrite the value in hydraulics and have the process engineer correct the simulation.  See the appropriate technology specific spreadsheet for the typical exchanger allowable pressure drops. If the maximum allowable pressure drop has been entered and UOP Hydraulics is giving 0 psi as the result, check if the stream has a viscosity value.  If the viscosity is missing, manually enter the value in the stream or change the Rating Method across Cases to “Mass**2',
                    
                ]
            }]
        }]
    }
};
/*
intents.matches('Intro', function (session) {
    session.sendTyping();
    session.send('Hi there!');
    session.beginDialog('/Help');
});
/*intents.matches('Help', function (session) {
    session.beginDialog('/Help');
});
intents.matches('FAQ', function (session) {
	//session.send('Hi there!');
	//bot.dialog('/', intents);
   session.beginDialog('/fq');
});

intents.matches('Detailed Description', function (session, args) {
    var product = null;
  /*  if (args && args.entities) {
        product = builder.EntityRecognizer.findEntity(args.entities, 'Product')
        session.privateConversationData.category = product.entity.toLowerCase();
    }
    session.beginDialog('/Exchanger');
});

intents.matches('Sketch of the doc', function (session, args) {
    var product = null;
   if (args && args.entities) {
        product = builder.EntityRecognizer.findEntity(args.entities, 'Product');
        session.privateConversationData.category = product.entity.toLowerCase();
    }
    session.beginDialog('/Vessel');
});

intents.onDefault([function (session) {
    session.replaceDialog('/Help');
}]);*/

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3979, function () {
    console.log('Listening.');
});
server.post('/api/messages', connector.listen());