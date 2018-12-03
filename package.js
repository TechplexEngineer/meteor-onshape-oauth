Package.describe({
  name: 'techplex:onshape',
  version: '0.0.1',
  summary: 'OAuth handler for Onshape',
  git: 'https://github.com/TechplexEngineer/meteor-onshape-oauth',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use('ecmascript');
  // api.use('accounts-ui', ['client', 'server']);
  api.use('oauth2', ['client', 'server']);
  api.use('oauth', ['client', 'server']);
  api.use('http', ['server']);
  api.use(['underscore', 'service-configuration'], ['client', 'server']);
  api.use(['random', 'templating'], 'client');

  api.export('Onshape');

  api.addFiles(
    ['onshape_configure.html', 'onshape_configure.js'],
    'client');

  api.addFiles('onshape_server.js', 'server');
  api.addFiles('onshape_client.js', 'client');
});
