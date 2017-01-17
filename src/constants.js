module.exports = {
  sns: {
    resource: 'topic',
    action: 'sns:Publish'
  },
  sqs: {
    resource: 'queue',
    action: 'sqs:SendMessage'
  }
};
