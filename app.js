const { App, LogLevel } = require("@slack/bolt");
const { echoSlashCommand, solaceSlashCommand } = require('./appCommand');
const { appHomeOpenedEvent, appLinkSharedEvent } = require('./appEvent');
const { helloMessage } = require('./appMessage');
const { blockActions, authorizeEPTokenAction, modifyEPTokenAction, getMoreResources, showHelpAction, showExamplesAction } = require('./appActions');
const { modalView } = require('./appViews');
const NodeCache = require( "node-cache" );
const cache = new NodeCache();

require("dotenv").config();
// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode:true,
  // logLevel: LogLevel.DEBUG,
  appToken: process.env.APP_TOKEN,
  port: process.env.PORT || 4000,
});

app.command('/echo', echoSlashCommand);
app.command('/solace', solaceSlashCommand);

app.event('app_home_opened', appHomeOpenedEvent);
app.event('link_shared', appLinkSharedEvent);

app.message('hello', helloMessage);

app.action('block_actions', blockActions);
app.action('click_authorize', authorizeEPTokenAction);
app.action('click_show_help', showHelpAction);
app.action('click_get_all', getMoreResources);
app.action('click_get_more', getMoreResources);

app.action('click_examples_domains', showExamplesAction);
app.action('click_examples_applications', showExamplesAction);
app.action('click_examples_events', showExamplesAction);
app.action('click_examples_schemas', showExamplesAction);

app.action('add_token', modifyEPTokenAction);

app.view('modal_view', modalView);

(async () => {
  // Start your app
  await app.start();

  console.log('⚡️ Bolt app is running!');
})();

module.exports = { app, cache };