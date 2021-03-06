"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("../util");
var Printer_1 = require("../Printer");
var CodePrinter_1 = require("../CodePrinter");
var WellKnown_1 = require("../WellKnown");
var FieldTypes_1 = require("../ts/FieldTypes");
var plugin_pb_1 = require("google-protobuf/google/protobuf/compiler/plugin_pb");
function generateGrpcWebService(filename, descriptor, exportMap) {
    return [
        createFile(generateTypescriptDefinition(descriptor, exportMap), filename + "_service.d.ts"),
        createFile(generateJavaScript(descriptor, exportMap), filename + "_service.js"),
    ];
}
exports.generateGrpcWebService = generateGrpcWebService;
function createFile(output, filename) {
    var file = new plugin_pb_1.CodeGeneratorResponse.File();
    file.setName(filename);
    file.setContent(output);
    return file;
}
function getCallingTypes(method, exportMap) {
    return {
        requestType: FieldTypes_1.getFieldType(FieldTypes_1.MESSAGE_TYPE, method.getInputType().slice(1), "", exportMap),
        responseType: FieldTypes_1.getFieldType(FieldTypes_1.MESSAGE_TYPE, method.getOutputType().slice(1), "", exportMap),
    };
}
function isUsed(fileDescriptor, pseudoNamespace, exportMap) {
    return fileDescriptor.getServiceList().some(function (service) {
        return service.getMethodList().some(function (method) {
            var callingTypes = getCallingTypes(method, exportMap);
            var namespacePackage = pseudoNamespace + ".";
            return (callingTypes.requestType.indexOf(namespacePackage) === 0 ||
                callingTypes.responseType.indexOf(namespacePackage) === 0);
        });
    });
}
var RPCDescriptor = (function () {
    function RPCDescriptor(grpcService, protoService, exportMap) {
        this.grpcService = grpcService;
        this.protoService = protoService;
        this.exportMap = exportMap;
    }
    Object.defineProperty(RPCDescriptor.prototype, "name", {
        get: function () {
            return this.protoService.getName();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RPCDescriptor.prototype, "qualifiedName", {
        get: function () {
            return (this.grpcService.packageName ? this.grpcService.packageName + "." : "") + this.name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RPCDescriptor.prototype, "methods", {
        get: function () {
            var _this = this;
            return this.protoService.getMethodList()
                .map(function (method) {
                var callingTypes = getCallingTypes(method, _this.exportMap);
                var nameAsCamelCase = method.getName()[0].toLowerCase() + method.getName().substr(1);
                return {
                    nameAsPascalCase: method.getName(),
                    nameAsCamelCase: nameAsCamelCase,
                    functionName: util_1.normaliseFieldObjectName(nameAsCamelCase),
                    serviceName: _this.name,
                    requestStream: method.getClientStreaming(),
                    responseStream: method.getServerStreaming(),
                    requestType: callingTypes.requestType,
                    responseType: callingTypes.responseType,
                };
            });
        },
        enumerable: true,
        configurable: true
    });
    return RPCDescriptor;
}());
var GrpcWebServiceDescriptor = (function () {
    function GrpcWebServiceDescriptor(fileDescriptor, exportMap) {
        this.fileDescriptor = fileDescriptor;
        this.exportMap = exportMap;
        this.pathToRoot = util_1.getPathToRoot(fileDescriptor.getName());
    }
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "filename", {
        get: function () {
            return this.fileDescriptor.getName();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "packageName", {
        get: function () {
            return this.fileDescriptor.getPackage();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "imports", {
        get: function () {
            var _this = this;
            var dependencies = this.fileDescriptor.getDependencyList()
                .filter(function (dependency) { return isUsed(_this.fileDescriptor, util_1.filePathToPseudoNamespace(dependency), _this.exportMap); })
                .map(function (dependency) {
                var namespace = util_1.filePathToPseudoNamespace(dependency);
                if (dependency in WellKnown_1.WellKnownTypesMap) {
                    return {
                        namespace: namespace,
                        path: WellKnown_1.WellKnownTypesMap[dependency],
                    };
                }
                else {
                    return {
                        namespace: namespace,
                        path: "" + _this.pathToRoot + util_1.replaceProtoSuffix(util_1.replaceProtoSuffix(dependency))
                    };
                }
            });
            var hostProto = {
                namespace: util_1.filePathToPseudoNamespace(this.filename),
                path: "" + this.pathToRoot + util_1.replaceProtoSuffix(this.filename),
            };
            return [hostProto].concat(dependencies);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GrpcWebServiceDescriptor.prototype, "services", {
        get: function () {
            var _this = this;
            return this.fileDescriptor.getServiceList()
                .map(function (service) {
                return new RPCDescriptor(_this, service, _this.exportMap);
            });
        },
        enumerable: true,
        configurable: true
    });
    return GrpcWebServiceDescriptor;
}());
function generateTypescriptDefinition(fileDescriptor, exportMap) {
    var serviceDescriptor = new GrpcWebServiceDescriptor(fileDescriptor, exportMap);
    var printer = new Printer_1.Printer(0);
    printer.printLn("// package: " + serviceDescriptor.packageName);
    printer.printLn("// file: " + serviceDescriptor.filename);
    printer.printEmptyLn();
    if (serviceDescriptor.services.length === 0) {
        return printer.getOutput();
    }
    serviceDescriptor.imports
        .forEach(function (importDescriptor) {
        printer.printLn("import * as " + importDescriptor.namespace + " from \"" + importDescriptor.path + "\";");
    });
    printer.printLn("import {grpc} from \"@improbable-eng/grpc-web\";");
    printer.printEmptyLn();
    serviceDescriptor.services
        .forEach(function (service) {
        service.methods.forEach(function (method) {
            printer.printLn("type " + method.serviceName + method.nameAsPascalCase + " = {");
            printer.printIndentedLn("readonly methodName: string;");
            printer.printIndentedLn("readonly service: typeof " + method.serviceName + ";");
            printer.printIndentedLn("readonly requestStream: " + method.requestStream + ";");
            printer.printIndentedLn("readonly responseStream: " + method.responseStream + ";");
            printer.printIndentedLn("readonly requestType: typeof " + method.requestType + ";");
            printer.printIndentedLn("readonly responseType: typeof " + method.responseType + ";");
            printer.printLn("};");
            printer.printEmptyLn();
        });
        printer.printLn("export class " + service.name + " {");
        printer.printIndentedLn("static readonly serviceName: string;");
        service.methods.forEach(function (method) {
            printer.printIndentedLn("static readonly " + method.nameAsPascalCase + ": " + method.serviceName + method.nameAsPascalCase + ";");
        });
        printer.printLn("}");
        printer.printEmptyLn();
    });
    printer.printLn("export type ServiceError = { message: string, code: number; metadata: grpc.Metadata }");
    printer.printLn("export type Status = { details: string, code: number; metadata: grpc.Metadata }");
    printer.printEmptyLn();
    printer.printLn("interface UnaryResponse {");
    printer.printIndentedLn("cancel(): void;");
    printer.printLn("}");
    printer.printLn("interface ResponseStream<T> {");
    printer.printIndentedLn("cancel(): void;");
    printer.printIndentedLn("on(type: 'data', handler: (message: T) => void): ResponseStream<T>;");
    printer.printIndentedLn("on(type: 'end', handler: (status?: Status) => void): ResponseStream<T>;");
    printer.printIndentedLn("on(type: 'status', handler: (status: Status) => void): ResponseStream<T>;");
    printer.printLn("}");
    printer.printLn("interface RequestStream<T> {");
    printer.printIndentedLn("write(message: T): RequestStream<T>;");
    printer.printIndentedLn("end(): void;");
    printer.printIndentedLn("cancel(): void;");
    printer.printIndentedLn("on(type: 'end', handler: (status?: Status) => void): RequestStream<T>;");
    printer.printIndentedLn("on(type: 'status', handler: (status: Status) => void): RequestStream<T>;");
    printer.printLn("}");
    printer.printLn("interface BidirectionalStream<ReqT, ResT> {");
    printer.printIndentedLn("write(message: ReqT): BidirectionalStream<ReqT, ResT>;");
    printer.printIndentedLn("end(): void;");
    printer.printIndentedLn("cancel(): void;");
    printer.printIndentedLn("on(type: 'data', handler: (message: ResT) => void): BidirectionalStream<ReqT, ResT>;");
    printer.printIndentedLn("on(type: 'end', handler: (status?: Status) => void): BidirectionalStream<ReqT, ResT>;");
    printer.printIndentedLn("on(type: 'status', handler: (status: Status) => void): BidirectionalStream<ReqT, ResT>;");
    printer.printLn("}");
    printer.printEmptyLn();
    serviceDescriptor.services
        .forEach(function (service) {
        printServiceStubTypes(printer, service);
        printer.printEmptyLn();
    });
    return printer.getOutput();
}
function generateJavaScript(fileDescriptor, exportMap) {
    var serviceDescriptor = new GrpcWebServiceDescriptor(fileDescriptor, exportMap);
    var printer = new Printer_1.Printer(0);
    printer.printLn("// package: " + serviceDescriptor.packageName);
    printer.printLn("// file: " + serviceDescriptor.filename);
    printer.printEmptyLn();
    if (serviceDescriptor.services.length === 0) {
        return printer.getOutput();
    }
    serviceDescriptor.imports
        .forEach(function (importDescriptor) {
        printer.printLn("var " + importDescriptor.namespace + " = require(\"" + importDescriptor.path + "\");");
    });
    printer.printLn("var grpc = require(\"@improbable-eng/grpc-web\").grpc;");
    printer.printEmptyLn();
    serviceDescriptor.services
        .forEach(function (service) {
        printer.printLn("var " + service.name + " = (function () {");
        printer.printIndentedLn("function " + service.name + "() {}");
        printer.printIndentedLn(service.name + ".serviceName = \"" + service.qualifiedName + "\";");
        printer.printIndentedLn("return " + service.name + ";");
        printer.printLn("}());");
        printer.printEmptyLn();
        service.methods
            .forEach(function (method) {
            printer.printLn(method.serviceName + "." + method.nameAsPascalCase + " = {");
            printer.printIndentedLn("methodName: \"" + method.nameAsPascalCase + "\",");
            printer.printIndentedLn("service: " + method.serviceName + ",");
            printer.printIndentedLn("requestStream: " + method.requestStream + ",");
            printer.printIndentedLn("responseStream: " + method.responseStream + ",");
            printer.printIndentedLn("requestType: " + method.requestType + ",");
            printer.printIndentedLn("responseType: " + method.responseType);
            printer.printLn("};");
            printer.printEmptyLn();
        });
        printer.printLn("exports." + service.name + " = " + service.name + ";");
        printer.printEmptyLn();
        printServiceStub(printer, service);
        printer.printEmptyLn();
    });
    return printer.getOutput();
}
function printServiceStub(methodPrinter, service) {
    var printer = new CodePrinter_1.CodePrinter(0, methodPrinter);
    printer
        .printLn("function " + service.name + "Client(serviceHost, options) {")
        .indent().printLn("this.serviceHost = serviceHost;")
        .printLn("this.options = options || {};")
        .dedent().printLn("}")
        .printEmptyLn();
    service.methods.forEach(function (method) {
        if (method.requestStream && method.responseStream) {
            printBidirectionalStubMethod(printer, method);
        }
        else if (method.requestStream) {
            printClientStreamStubMethod(printer, method);
        }
        else if (method.responseStream) {
            printServerStreamStubMethod(printer, method);
        }
        else {
            printUnaryStubMethod(printer, method);
        }
        printer.printEmptyLn();
    });
    printer.printLn("exports." + service.name + "Client = " + service.name + "Client;");
}
function printUnaryStubMethod(printer, method) {
    printer
        .printLn(method.serviceName + "Client.prototype." + method.nameAsCamelCase + " = function " + method.functionName + "(requestMessage, metadata, callback) {")
        .indent().printLn("if (arguments.length === 2) {")
        .indent().printLn("callback = arguments[1];")
        .dedent().printLn("}")
        .printLn("var client = grpc.unary(" + method.serviceName + "." + method.nameAsPascalCase + ", {")
        .indent().printLn("request: requestMessage,")
        .printLn("host: this.serviceHost,")
        .printLn("metadata: metadata,")
        .printLn("transport: this.options.transport,")
        .printLn("debug: this.options.debug,")
        .printLn("onEnd: function (response) {")
        .indent().printLn("if (callback) {")
        .indent().printLn("if (response.status !== grpc.Code.OK) {")
        .indent().printLn("var err = new Error(response.statusMessage);")
        .printLn("err.code = response.status;")
        .printLn("err.metadata = response.trailers;")
        .printLn("callback(err, null);")
        .dedent().printLn("} else {")
        .indent().printLn("callback(null, response.message);")
        .dedent().printLn("}")
        .dedent().printLn("}")
        .dedent().printLn("}")
        .dedent().printLn("});")
        .printLn("return {")
        .indent().printLn("cancel: function () {")
        .indent().printLn("callback = null;")
        .printLn("client.close();")
        .dedent().printLn("}")
        .dedent().printLn("};")
        .dedent().printLn("};");
}
function printServerStreamStubMethod(printer, method) {
    printer
        .printLn(method.serviceName + "Client.prototype." + method.nameAsCamelCase + " = function " + method.functionName + "(requestMessage, metadata) {")
        .indent().printLn("var listeners = {")
        .indent().printLn("data: [],")
        .printLn("end: [],")
        .printLn("status: []")
        .dedent().printLn("};")
        .printLn("var client = grpc.invoke(" + method.serviceName + "." + method.nameAsPascalCase + ", {")
        .indent().printLn("request: requestMessage,")
        .printLn("host: this.serviceHost,")
        .printLn("metadata: metadata,")
        .printLn("transport: this.options.transport,")
        .printLn("debug: this.options.debug,")
        .printLn("onMessage: function (responseMessage) {")
        .indent().printLn("listeners.data.forEach(function (handler) {")
        .indent().printLn("handler(responseMessage);")
        .dedent().printLn("});")
        .dedent().printLn("},")
        .printLn("onEnd: function (status, statusMessage, trailers) {")
        .indent().printLn("listeners.status.forEach(function (handler) {")
        .indent().printLn("handler({ code: status, details: statusMessage, metadata: trailers });")
        .dedent().printLn("});")
        .printLn("listeners.end.forEach(function (handler) {")
        .indent().printLn("handler({ code: status, details: statusMessage, metadata: trailers });")
        .dedent().printLn("});")
        .printLn("listeners = null;")
        .dedent().printLn("}")
        .dedent().printLn("});")
        .printLn("return {")
        .indent().printLn("on: function (type, handler) {")
        .indent().printLn("listeners[type].push(handler);")
        .printLn("return this;")
        .dedent().printLn("},")
        .printLn("cancel: function () {")
        .indent().printLn("listeners = null;")
        .printLn("client.close();")
        .dedent().printLn("}")
        .dedent().printLn("};")
        .dedent().printLn("};");
}
function printClientStreamStubMethod(printer, method) {
    printer
        .printLn(method.serviceName + "Client.prototype." + method.nameAsCamelCase + " = function " + method.functionName + "(metadata) {")
        .indent().printLn("var listeners = {")
        .indent().printLn("end: [],")
        .printLn("status: []")
        .dedent().printLn("};")
        .printLn("var client = grpc.client(" + method.serviceName + "." + method.nameAsPascalCase + ", {")
        .indent().printLn("host: this.serviceHost,")
        .printLn("metadata: metadata,")
        .printLn("transport: this.options.transport")
        .dedent().printLn("});")
        .printLn("client.onEnd(function (status, statusMessage, trailers) {")
        .indent().printLn("listeners.status.forEach(function (handler) {")
        .indent().printLn("handler({ code: status, details: statusMessage, metadata: trailers });")
        .dedent().printLn("});")
        .printLn("listeners.end.forEach(function (handler) {")
        .indent().printLn("handler({ code: status, details: statusMessage, metadata: trailers });")
        .dedent().printLn("});")
        .printLn("listeners = null;")
        .dedent().printLn("});")
        .printLn("return {")
        .indent().printLn("on: function (type, handler) {")
        .indent().printLn("listeners[type].push(handler);")
        .printLn("return this;")
        .dedent().printLn("},")
        .printLn("write: function (requestMessage) {")
        .indent().printLn("if (!client.started) {")
        .indent().printLn("client.start(metadata);")
        .dedent().printLn("}")
        .printLn("client.send(requestMessage);")
        .printLn("return this;")
        .dedent().printLn("},")
        .printLn("end: function () {")
        .indent().printLn("client.finishSend();")
        .dedent().printLn("},")
        .printLn("cancel: function () {")
        .indent().printLn("listeners = null;")
        .printLn("client.close();")
        .dedent().printLn("}")
        .dedent().printLn("};")
        .dedent().printLn("};");
}
function printBidirectionalStubMethod(printer, method) {
    printer
        .printLn(method.serviceName + "Client.prototype." + method.nameAsCamelCase + " = function " + method.functionName + "(metadata) {")
        .indent().printLn("var listeners = {")
        .indent().printLn("data: [],")
        .printLn("end: [],")
        .printLn("status: []")
        .dedent().printLn("};")
        .printLn("var client = grpc.client(" + method.serviceName + "." + method.nameAsPascalCase + ", {")
        .indent().printLn("host: this.serviceHost,")
        .printLn("metadata: metadata,")
        .printLn("transport: this.options.transport")
        .dedent().printLn("});")
        .printLn("client.onEnd(function (status, statusMessage, trailers) {")
        .indent().printLn("listeners.status.forEach(function (handler) {")
        .indent().printLn("handler({ code: status, details: statusMessage, metadata: trailers });")
        .dedent().printLn("});")
        .printLn("listeners.end.forEach(function (handler) {")
        .indent().printLn("handler({ code: status, details: statusMessage, metadata: trailers });")
        .dedent().printLn("});")
        .printLn("listeners = null;")
        .dedent().printLn("});")
        .printLn("client.onMessage(function (message) {")
        .indent().printLn("listeners.data.forEach(function (handler) {")
        .indent().printLn("handler(message);")
        .dedent().printLn("})")
        .dedent().printLn("});")
        .printLn("client.start(metadata);")
        .printLn("return {")
        .indent().printLn("on: function (type, handler) {")
        .indent().printLn("listeners[type].push(handler);")
        .printLn("return this;")
        .dedent().printLn("},")
        .printLn("write: function (requestMessage) {")
        .indent().printLn("client.send(requestMessage);")
        .printLn("return this;")
        .dedent().printLn("},")
        .printLn("end: function () {")
        .indent().printLn("client.finishSend();")
        .dedent().printLn("},")
        .printLn("cancel: function () {")
        .indent().printLn("listeners = null;")
        .printLn("client.close();")
        .dedent().printLn("}")
        .dedent().printLn("};")
        .dedent().printLn("};");
}
function printServiceStubTypes(methodPrinter, service) {
    var printer = new CodePrinter_1.CodePrinter(0, methodPrinter);
    printer
        .printLn("export class " + service.name + "Client {")
        .indent().printLn("readonly serviceHost: string;")
        .printEmptyLn()
        .printLn("constructor(serviceHost: string, options?: grpc.RpcOptions);");
    service.methods.forEach(function (method) {
        if (method.requestStream && method.responseStream) {
            printBidirectionalStubMethodTypes(printer, method);
        }
        else if (method.requestStream) {
            printClientStreamStubMethodTypes(printer, method);
        }
        else if (method.responseStream) {
            printServerStreamStubMethodTypes(printer, method);
        }
        else {
            printUnaryStubMethodTypes(printer, method);
        }
    });
    printer.dedent().printLn("}");
}
function printUnaryStubMethodTypes(printer, method) {
    printer
        .printLn(method.nameAsCamelCase + "(")
        .indent().printLn("requestMessage: " + method.requestType + ",")
        .printLn("metadata: grpc.Metadata,")
        .printLn("callback: (error: ServiceError|null, responseMessage: " + method.responseType + "|null) => void")
        .dedent().printLn("): UnaryResponse;")
        .printLn(method.nameAsCamelCase + "(")
        .indent().printLn("requestMessage: " + method.requestType + ",")
        .printLn("callback: (error: ServiceError|null, responseMessage: " + method.responseType + "|null) => void")
        .dedent().printLn("): UnaryResponse;");
}
function printServerStreamStubMethodTypes(printer, method) {
    printer.printLn(method.nameAsCamelCase + "(requestMessage: " + method.requestType + ", metadata?: grpc.Metadata): ResponseStream<" + method.responseType + ">;");
}
function printClientStreamStubMethodTypes(printer, method) {
    printer.printLn(method.nameAsCamelCase + "(metadata?: grpc.Metadata): RequestStream<" + method.requestType + ">;");
}
function printBidirectionalStubMethodTypes(printer, method) {
    printer.printLn(method.nameAsCamelCase + "(metadata?: grpc.Metadata): BidirectionalStream<" + method.requestType + ", " + method.responseType + ">;");
}
//# sourceMappingURL=grpcweb.js.map