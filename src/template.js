'use strict';

const _            = require('lodash'),
      namingHelper = require('./naming'),
      definitions  = require('./definitions')();

function getDeadLetterResource(type, name) {
  const defs = definitions[_.lowerCase(type)];
  const deadLetterNameSuffix = `${_.upperFirst(_.camelCase(name))}LambdaFunctionError`;

  return {
    [`${_.upperCase(type)}${_.upperFirst(defs.resource)}${_.upperFirst(_.camelCase(name))}`]: {
      Type: `AWS::${_.upperCase(type)}::${_.upperFirst(defs.resource)}`,
      Properties: {
        [`${_.upperFirst(defs.resource)}Name`]: name
      }
    }
  };
}

function getDeadLetterPolicy(type, settings) {
  const awsService = _.lowerCase(type);
  const defs = definitions[awsService];

  return {
    [namingHelper.getDeadLetterPolicyName(type)]: {
      Type: 'AWS::IAM::Policy',
      DependsOn: [],
      Properties: {
        PolicyName: `${settings.stage}-${settings.service}-deadletter${defs.resource}`,
        PolicyDocument: {
          Version: "2012-10-17",
          Statement: [{
            Effect: 'Allow',
            Action: [
              defs.action
            ],
            Resource: `arn:aws:${awsService}:${settings.region}:${settings.accountId}:*`
          }]
        },
        Roles: []
      }
    }
  };
}

function addRoleToPolicy(policy, roleName) {
  const dlPolicyName = Object.keys(policy)[0];
  const dependencies = {
    [dlPolicyName]: {
      DependsOn: _.union(policy[dlPolicyName].DependsOn, [roleName])
    }
  };
  const roles = {
    [dlPolicyName]: {
      Properties: {
        Roles: _.union(policy[dlPolicyName].Properties.Roles, [{
          Ref: roleName
        }])
      }
    }
  };
  return _.merge({}, policy, dependencies, roles);
}

module.exports = {
  getDeadLetterPolicy: getDeadLetterPolicy,
  getDeadLetterResource: getDeadLetterResource,
  addRoleToPolicy: addRoleToPolicy
};
