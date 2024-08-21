"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
// Use gpt-4o since it is fast and high quality. gpt-3.5-turbo and gpt-4 are also available.
const MODEL_SELECTOR = { vendor: 'copilot', family: 'gpt-4o' };
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand("llm-api-tutor-example.annotate", async (textEditor) => {
        // clear out all text decorations in the current editor
        textEditor.setDecorations(vscode.window.createTextEditorDecorationType({}), []);
        let chatResponse;
        try {
            const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
            if (!model) {
                console.log("No model found.");
                return;
            }
            const codeWithLineNumbers = await getCodeWithLineNumbers(textEditor, textEditor.selection);
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are a code tutor who helps students learn how to write better code. Your job is to evaluate a block of code that the user gives you. You will then annotate any lines that could be improved with a brief suggestion. Only make suggestions when you feel the severity is enough that it will impact the readibility and maintainability of the code. Each suggestion should end with a new line. If several lines need the same suggestion, you can combine those into a single suggestion by listing out the line numbers in your suggestion. Format your response so that you indicate a new suggestion with @ followed by the line number the suggestion applies to followed by a space followed by a message. Here is an example response: '@3 Imports should appear at the top of the file.' Sometimes you will have no suggestions in which case you can just return '@0 No suggestions.'`),
                vscode.LanguageModelChatMessage.User(`Here is the code I would like you to evaluate: ${codeWithLineNumbers}`),
            ];
            chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        }
        catch (err) {
            if (err instanceof vscode.LanguageModelError) {
                console.log(err.message, err.code, err.cause);
            }
            else {
                throw err;
            }
            return;
        }
        try {
            if (chatResponse) {
                await processChatResponseFragments(chatResponse, textEditor);
            }
        }
        catch (err) {
            console.log(err);
        }
    }));
}
exports.activate = activate;
async function processChatResponseFragments(chatResponse, textEditor) {
    let isNewLine = false;
    let annotationLineNumber = 0;
    let annotation = "";
    let accumulatedResponse = "";
    for await (const fragment of chatResponse.text) {
        accumulatedResponse += fragment;
        // Check if the accumulated response contains a complete suggestion
        const suggestions = accumulatedResponse.split("\n");
        for (let i = 0; i < suggestions.length - 1; i++) {
            const suggestion = suggestions[i];
            if (suggestion.startsWith('@')) {
                const [lineNumber, ...messageParts] = suggestion.slice(1).split(' ');
                const message = messageParts.join(' ');
                const line = parseInt(lineNumber, 10);
                if (line > 0) {
                    // Apply decoration to the editor
                    applyDecoration(textEditor, line, message);
                }
            }
        }
        // Keep the last incomplete suggestion in the accumulator
        accumulatedResponse = suggestions[suggestions.length - 1];
        // // if the fragment is an @, this indicates a new line.
        // if (fragment === "@") {
        // 	// write the previous annotation as a message with a decoration at the end of the line
        // 	if (annotationLineNumber > 0) {
        // 		const lineLength = textEditor.document.lineAt(annotationLineNumber - 1).text.length;
        // 		const range = new vscode.Range(annotationLineNumber - 1, lineLength, annotationLineNumber - 1, lineLength);
        // 		// if the annotation is too long to fit on the line, truncate it and add the full message in a tooltip
        // 		const maxLength = 25;
        // 		const truncatedAnnotation = annotation.length > maxLength ? annotation.substring(0, maxLength) + "..." : annotation;
        // 		const decoration = {
        // 			range,
        // 			renderOptions: {
        // 				after: {
        // 					contentText: ` ${truncatedAnnotation}`,
        // 					color: "green"
        // 				}
        // 			},
        // 			hoverMessage: annotation
        // 		};
        // 		textEditor.setDecorations(vscode.window.createTextEditorDecorationType({}), [decoration]);
        // 	}
        // 	isNewLine = true;
        // 	annotation = "";
        // 	continue;
        // }
        // // if the previous fragment was an @, this fragment is a line number.
        // if (isNewLine) {
        // 	isNewLine = false;
        // 	annotationLineNumber = parseInt(fragment);
        // 	continue;
        // }
        // // otherwise, this fragment is part of the message for the line
        // annotation += fragment;
    }
}
async function getCodeWithLineNumbers(textEditor, selection) {
    let selectedText = "";
    let startLineNumber = 0;
    let endLineNumber = 0;
    if (!selection) {
        const fullRange = new vscode.Range(textEditor.visibleRanges[0].start, textEditor.visibleRanges[0].end);
        selectedText = textEditor.document.getText(fullRange);
        startLineNumber = textEditor.visibleRanges[0].start.line + 1;
        endLineNumber = textEditor.visibleRanges[0].end.line + 1;
    }
    else {
        selectedText = textEditor.document.getText(selection);
        startLineNumber = selection.start.line + 1;
        endLineNumber = selection.end.line + 1;
    }
    const lines = selectedText.split("\n");
    const linesWithNumbers = lines.map((line, index) => `${startLineNumber + index}: ${line}`);
    const numberedCode = linesWithNumbers.join("\n");
    return numberedCode;
}
function applyDecoration(editor, line, message) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: message,
            color: 'red',
        },
    });
    const range = new vscode.Range(new vscode.Position(line - 1, 0), new vscode.Position(line - 1, 0));
    editor.setDecorations(decorationType, [range]);
}
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map