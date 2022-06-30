const JsonDB = require('node-json-db').JsonDB;
const db = new JsonDB('tokens', true, false);

const {
  getSolaceApplicationDomains,
  getSolaceApplications,
  getSolaceApplicationVersions,
  getSolaceEvents,
  getSolaceEventVersions,
  getSolaceSchemas,
  getSolaceSchemaVersions

} = require('./solCommands')
const {
  buildDomainBlocks,
  buildApplicationBlocks,
  buildApplicationVersionBlocks,
  buildEventBlocks,
  buildEventVersionBlocks,
  buildSchemaBlocks,
  buildSchemaVersionBlocks
} = require('./buildBlocks');
const {
  postRegisterMessage,
  checkArrayOfArrays
} = require('./appUtils')

const parseSolaceLink = (link) => {
  let url = new URL(link.replaceAll('&amp;', '&'));
  if (!url.pathname.startsWith('/ep'))
    return false;

  let cmd = {};
  if (url.pathname === '/ep/designer') {
    cmd.resource = 'domains';
    cmd.scope = 'all';
    return cmd;
  }
  let vals = url.pathname.split('/');
  for (let j=0; j<vals.length; j++) {
    if (vals[j] === 'domains') {
      cmd.resource = 'domains';            
      if (!vals[j+1]) {
        cmd.scope = 'all';
      } else {
        cmd.scope = 'id';
        cmd.domainId = vals[j+1]
      }
    }
    if (vals[j] === 'applications' && vals[j+1]) {
      cmd.resource = 'applications';            
      if (!vals[j+1]) {
        cmd.scope = 'all';
      } else {
        cmd.scope = 'id';
        cmd.applicationId = vals[j+1]
      }
    }
    if (vals[j] === 'events' && vals[j+1]) {
      cmd.resource = 'events';            
      if (!vals[j+1]) {
        cmd.scope = 'all';
      } else {
        cmd.scope = 'id';
        cmd.eventId = vals[j+1]
      }
    }
    if (vals[j] === 'schemas' && vals[j+1]) {
      cmd.resource = 'schemas';            
      if (!vals[j+1]) {
        cmd.scope = 'all';
      } else {
        cmd.scope = 'id';
        cmd.schemaId = vals[j+1]
      }
    }
  }

  if (url.pathname.indexOf('/domains/') > 0 || url.pathname.indexOf('/domains?') > 0 ||url.pathname.endsWith('/domains')) {
    cmd.scope = 'all';
    cmd.resource = 'domains';
    if (url.searchParams.has('selectedDomainId')) {
      cmd.scope = 'id';
      cmd.resource = 'domains';
      cmd.domainId = url.searchParams.get('selectedDomainId');
    }
    if (cmd.domainId) {
      cmd.scope = 'id'
    }
  }

  if (url.pathname.indexOf('/applications/') > 0 || url.pathname.indexOf('/applications?') > 0 ||url.pathname.endsWith('/applications')) {
    cmd.scope = 'all';
    cmd.resource = 'applications';
    if (url.searchParams.has('selectedId')) {
      cmd.scope = 'id';
      cmd.resource = 'applications';
      cmd.applicationId = url.searchParams.get('selectedId');
    }
    if (url.searchParams.has('selectedVersionId')) {
      cmd.scope = 'id';
      cmd.resource = 'applications';
      cmd.versionId = url.searchParams.get('selectedVersionId');
    }
    if (cmd.applicationId) {
      cmd.scope = 'id'
    }
  }
  if (url.pathname.indexOf('/events/') > 0 || url.pathname.indexOf('/events?') > 0 ||url.pathname.endsWith('/events')) {
    cmd.scope = 'all';
    cmd.resource = 'events';
    if (url.searchParams.has('selectedId')) {
      cmd.scope = 'id';
      cmd.resource = 'events';
      cmd.eventId = url.searchParams.get('selectedId');
    }
    if (url.searchParams.has('selectedVersionId')) {
      cmd.scope = 'id';
      cmd.resource = 'events';
      cmd.versionId = url.searchParams.get('selectedVersionId');
    }
    if (cmd.eventId) {
      cmd.scope = 'id'
    }
  }

  if (url.pathname.indexOf('/schemas/') > 0 || url.pathname.indexOf('/schemas?') > 0 ||url.pathname.endsWith('/schemas')) {
    cmd.scope = 'all';
    cmd.resource = 'schemas';
    if (url.searchParams.has('selectedId')) {
      cmd.scope = 'id';
      cmd.resource = 'schemas';
      cmd.schemaId = url.searchParams.get('selectedId');
    }
    if (url.searchParams.has('selectedVersionId')) {
      cmd.scope = 'id';
      cmd.resource = 'schemas';
      cmd.versionId = url.searchParams.get('selectedVersionId');
    }
    if (cmd.schemaId) {
      cmd.scope = 'id'
    }
  }

  for (const [key, value] of url.searchParams.entries())  
    cmd[key] = value;

  console.log('cmd:', cmd);
  return cmd;
}

const appHomeOpenedEvent = async({event, context, payload}) => {
  console.log('bot:app_home_opened');
  const { app } = require('./app')
  const appHome = require('./appHome');

  const userId = payload.user;

  // Display App Home
  const homeView = await appHome.createHome(userId);
  
  try {
    const result = await app.client.views.publish({
      token: process.env.SLACK_BOT_TOKEN,
      user_id: event.user,
      view: homeView
    });
    
  } catch(e) {
    app.error(e);
  }  
}

const appLinkSharedEvent = async({event, context, payload}) => {
  console.log('bot:link_shared');
  const { app } = require('./app')

  let resultBlock = [];
  let errorBlock = null;

  for (var i=0; i<payload.links.length; i++) {
    try {
      let cmd = parseSolaceLink(payload.links[i].url);
      let solaceCloudToken = undefined;
      try {
        db.reload();
        solaceCloudToken = db.getData(`/${payload.user}/data`);
      } catch(error) {
        console.error(error); 
      }
    
      if (!solaceCloudToken) {
        await postRegisterMessage(payload.channel, payload.user_id);
        return;
      }
      
      const headerBlock = [
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Discover, Visualize and Catalog Your Event Streams With PubSub+ Event Portal*\n\n"
          },
        },
        {
          type: "divider"
        }
      ]
    
      let response = undefined;

      if (cmd.resource === 'domains') {
        let options = { id: cmd.domainId, pageSize: 5, pageNumber: 1}
        response = await getSolaceApplicationDomains(cmd.scope, solaceCloudToken, options)
        if (!response.data.length)
          resultBlock = emptyBlock;
        else {
          resultBlock = buildDomainBlocks(response.data, solaceCloudToken.domain, {cmd, options, meta: response.meta}); 
          resultBlock[0] = headerBlock.concat(resultBlock[0]);
        } 
      } else if (cmd.resource === 'applications') {
        let options = { id: cmd.applicationId, domainId: cmd.domainId, domainName: cmd.domainName, 
                        versionId: cmd.versionId, pageSize: 5, pageNumber: 1}
        if (cmd.versionId) {
          response = await getSolaceApplicationVersions(cmd.applicationId, solaceCloudToken, options)
          if (!response.data.length)
            resultBlock = emptyBlock;
          else
            resultBlock = buildApplicationVersionBlocks(response.data, solaceCloudToken.domain, {cmd, options, meta: response.meta});        
        } else {
          response = await getSolaceApplications(cmd.scope, solaceCloudToken, options)
          if (!response.data.length)
            resultBlock = emptyBlock;
          else
            resultBlock = buildApplicationBlocks(response.data, solaceCloudToken.domain, {cmd, options, meta: response.meta});        
        }        
      } 
      else if (cmd.resource === 'events') {
        let options = { id: cmd.eventId, domainId: cmd.domainId, domainName: cmd.domainName, 
                        versionId: cmd.versionId, pageSize: 5, pageNumber: 1}
        if (cmd.versionId) {
          response = await getSolaceEventVersions(cmd.eventId, solaceCloudToken, options)
          if (!response.data.length)
            resultBlock = emptyBlock;
          else
            resultBlock = buildEventVersionBlocks(response.data, solaceCloudToken.domain, {cmd, options, meta: response.meta});        
        } else {
          response = await getSolaceEvents(cmd.scope, solaceCloudToken, options)
          if (!response.data.length)
            resultBlock = emptyBlock;
          else
            resultBlock = buildEventBlocks(response.data, solaceCloudToken.domain, {cmd, options, meta: response.meta});        
        }        
      } else if (cmd.resource === 'schemas') {
        let options = { id: cmd.schemaId, domainId: cmd.domainId, domainName: cmd.domainName, 
                        versionId: cmd.versionId, pageSize: 5, pageNumber: 1}
        if (cmd.versionId) {
          response = await getSolaceSchemaVersions(cmd.schemaId, solaceCloudToken, options)
          if (!response.data.length)
            resultBlock = emptyBlock;
          else
            resultBlock = buildSchemaVersionBlocks(response.data, solaceCloudToken.domain, {cmd, options, meta: response.meta});        
        } else {
          response = await getSolaceSchemas(cmd.scope, solaceCloudToken, options)
          if (!response.data.length)
            resultBlock = emptyBlock;
          else
            resultBlock = buildSchemaBlocks(response.data, solaceCloudToken.domain, {cmd, options, meta: response.meta});        
        }   
      }
    } catch (error) {
      errorBlock = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: error.message
          },
        },
        {
          type: "divider"
        }
      ]
    }

    try {
      if (errorBlock) 
        await app.client.chat.postEphemeral({
          token: process.env.SLACK_BOT_TOKEN,
          channel: payload.channel,
          user: payload.user,
          errorBlock,
          text: 'Unfurl error'
        });
      else {
        if (checkArrayOfArrays(resultBlock)) {
          for (let j=0; j<resultBlock.length; j++) {
          
            let unfurls = {};
            unfurls[payload.links[i].url] = {
              blocks: resultBlock[j]
            }
                  
            await app.client.chat.unfurl({
              token: process.env.SLACK_BOT_TOKEN,
              ts: event.message_ts,
              channel: payload.channel,
              unfurls: JSON.stringify(unfurls),
              text: 'Unfurl successful'
            });
          }
        } else {          
          let unfurls = {};
          unfurls[payload.links[i].url] = {
            blocks: resultBlock
          }
              
          await app.client.chat.unfurl({
            token: process.env.SLACK_BOT_TOKEN,
            ts: event.message_ts,
            channel: payload.channel,
            unfurls: JSON.stringify(unfurls),
            text: 'Unfurl successful'
          });
        }
    
      }
    } catch (error) {
      console.error(error);
    }    
  }
}

module.exports = { 
  appHomeOpenedEvent,
  appLinkSharedEvent
};