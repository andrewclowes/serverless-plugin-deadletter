'use strict';

const _           = require('lodash'),
      definitions = require('./definitions')();

function isArn(targetName) {
  var regexp = /arn:aws:([a-zA-Z0-9\-])+:([a-z]{2}-[a-z]+-\d{1})?:(\d{12})?:(.*)/;
  return targetName.match(regexp) !== null;
}

function getDeadLetterPolicyName(type) {
  const defs = definitions[_.lowerCase(type)];
  return `IamPolicyDeadLetter${_.upperFirst(defs.resource)}`;
}

function getDeadLetterTargetArn(type, targetName, settings) {
  return `arn:aws:${_.lowerCase(type)}:${settings.region}:${settings.accountId}:${targetName}`;
}

module.exports = {
  isArn: isArn,
  getDeadLetterPolicyName: getDeadLetterPolicyName,
  getDeadLetterTargetArn: getDeadLetterTargetArn
}
