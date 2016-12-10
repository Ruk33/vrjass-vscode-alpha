/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind, CompletionList
} from 'vscode-languageserver';

var exec = require('child_process').exec;

var vrjs = exec('java -jar c:/users/ruke/intellij/vrj/build/libs/vrj.jar', {maxBuffer: 1024*1024});

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// The settings interface describe the server relevant settings part
interface Settings {
	languageServerExample: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
	// Revalidate any open text documents
	//documents.all().forEach(validateTextDocument);
});

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.', '(', ' ', ',']
			}
		}
	}
});

var initialized = false;
var suggestPromise;

function onEditArrived(data) {
	let diagnostics: Diagnostic[] = [];
	for (var i = 0, max = data.errors.length; i < max; i++) {
		diagnostics.push({
			severity: DiagnosticSeverity.Error,
			range: data.errors[i].range,
			message: data.errors[i].message
		});
	}
	connection.sendDiagnostics({ uri: data.uri, diagnostics });
}

function onSuggestArrived(data) {
	if (suggestPromise) {
		suggestPromise(data.suggestions);
		suggestPromise = null;
	}
}

connection.onShutdown(function() {
	vrjs.stdin.end('exit');
	vrjs.kill();
});

connection.onExit(function() {
	vrjs.stdin.end('exit');
	vrjs.kill();
});

function sendRequest(data:{type: string, data:any}) {
	try {
		var request = JSON.stringify(data) + '\n';
		vrjs.stdin.write(request);
	} catch (e) {
		console.log(e)
	}
}

var timer;
var data:any = {};
var cursorLine = -1;

function sendData() {
	if (data.edit) {
		sendRequest({ type: 'edit', data: data.edit });
	}

	if (data.suggest) {
		sendRequest({ type: 'suggest', data: data.suggest });
	}
}

connection.onDidChangeTextDocument((e) => {
	if (timer) {
		clearTimeout(timer);
	}

	timer = setTimeout(sendData, 200);

	data.edit = { 
		uri: e.textDocument.uri,
		content: e.contentChanges[0].text,
		line: cursorLine,
		range: 20
	};
})

connection.onCompletion((t: TextDocumentPositionParams): Thenable<CompletionItem[]> => {
	if (timer) {
		clearTimeout(timer);
	}

	timer = setTimeout(sendData, 200);

	cursorLine = t.position.line + 1;

	data.suggest = {
		line: t.position.line + 1,
		char: t.position.character,
		uri: t.textDocument.uri
	};
	
	return new Promise(function (resolve, reject) {
		if (suggestPromise) {
			suggestPromise([]);
		}
		suggestPromise = resolve;
	});
})

connection.onDidOpenTextDocument((params) => {
	sendRequest({ type: 'edit', data: {
		uri: params.textDocument.uri,
		content: params.textDocument.text
	} });
});

vrjs.stdout.on('data', function(e) {
	if (!initialized) {
		initialized = true;
		return;
	}

	//console.log('data arrived');
	//console.log(e);

	try {
		var response = JSON.parse(e);

		if (response.edit) {
			onEditArrived(response.edit);
		}

		if (response.suggest) {
			onSuggestArrived(response.suggest);
			data.suggest = null;
		}
	} catch (e) {
		console.log(e)
	}
});

// Listen on the connection
connection.listen();