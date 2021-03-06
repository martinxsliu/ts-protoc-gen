import {assert} from "chai";
import {oneOfName, replaceProtoSuffix, snakeToCamel} from "../../src/util";

describe("util", () => {
  describe("replaceProtoSuffix", () => {
    [{
      in: "github.com/improbable-eng/ts-protoc-gen/test/proto/examplecom/enum_message.proto",
      out: "github.com/improbable-eng/ts-protoc-gen/test/proto/examplecom/enum_message_pb",
    }, {
      in: "enum_message.proto",
      out: "enum_message_pb",
    }, {
      in: "enum_message.js",
      out: "enum_message.js",
    }, {
      in: ".proto/enum_message.proto",
      out: ".proto/enum_message_pb",
    }, {
      in: "protos/.proto/enum_message.proto",
      out: "protos/.proto/enum_message_pb",
    }, {
      in: "",
      out: "",
    }].forEach(scenario => {
      it(`should map '${scenario.in}' to '${scenario.out}'`, () => {
        const actual = replaceProtoSuffix(scenario.in);
        assert.equal(actual, scenario.out);
      });
    });
  });

  describe("oneOfName", () => {
    [{
      in: "one_of_name",
      out: "OneOfName",
    }, {
      in: "ONE_OF_NAME",
      out: "OneOfName",
    }, {
      in: "OneOfName",
      out: "Oneofname"
    }].forEach(scenario => {
      it(`should map '${scenario.in}' to '${scenario.out}'`, () => {
          const actual = oneOfName(scenario.in);
          assert.equal(actual, scenario.out);
      });
    });
  });

  describe("snakeToCamel", () => {
    [{
      in: "foo_bar_baz",
      out: "fooBarBaz",
    }, {
      in: "foo_bar__baz",
      out: "fooBarBaz",
    }, {
      in: "foo_bar___baz",
      out: "fooBarBaz",
    }].forEach(scenario => {
      it(`should map '${scenario.in}' to '${scenario.out}'`, () => {
        const actual = snakeToCamel(scenario.in);
        assert.equal(actual, scenario.out);
      });
    });
  });
});
