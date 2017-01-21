'use strict';

const definitions = {
  sns: {
    resource: 'topic',
    action: 'sns:Publish'
  },
  sqs: {
    resource: 'queue',
    action: 'sqs:SendMessage'
  }
};

module.exports = () => Object.assign({}, definitions);
