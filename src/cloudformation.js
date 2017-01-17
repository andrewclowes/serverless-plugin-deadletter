'use strict';

const _            = require('lodash');
const awsConstants = require('./constants');

function getDeadLetterResource(type, name) {
  const vals = awsConstants[_.lowerCase(type)];
  const deadLetterNameSuffix = `${_.upperFirst(_.camelCase(name))}LambdaFunctionError`;

  return {
    [`${_.upperCase(type)}${_.upperFirst(vals.resource)}${_.upperFirst(_.camelCase(name))}`]: {
      Type: `AWS::${_.upperCase(type)}::${_.upperFirst(vals.resource)}`,
      Properties: {
        [`${_.upperFirst(vals.resource)}Name`]: name
      }
    }
  };
}

function getDeadLetterPolicyName(type) {
  const vals = awsConstants[_.lowerCase(type)];
  return `IamPolicyDeadLetter${_.upperFirst(vals.resource)}`;
}

function getDeadLetterPolicy(type, settings) {
  const awsService = _.lowerCase(type);
  const vals = awsConstants[awsService];

  return {
    [getDeadLetterPolicyName(type)]: {
      Type: 'AWS::IAM::Policy',
      DependsOn: [],
      Properties: {
        PolicyName: `${settings.stage}-${settings.service}-deadletter${vals.resource}`,
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                vals.action
              ],
              Resource: `arn:aws:${awsService}:${settings.region}:${settings.accountId}:*`
            }
          ]
        },
        Roles: []
      }
    }
  };
}

module.exports = {
  getDeadLetterPolicy: getDeadLetterPolicy,
  getDeadLetterPolicyName: getDeadLetterPolicyName,
  getDeadLetterResource: getDeadLetterResource
};
