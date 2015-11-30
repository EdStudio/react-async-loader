import React from 'react';
import hoistStatics from 'hoist-non-react-statics';

function getDisplayName(Component) {
  return Component.displayName || Component.name || 'Component';
}

function getScript (globalPath) {
  const paths = globalPath.split('.');
  let root = window || {};

  for (var i = 0; i < paths.length; i++) {
    const path = paths[i];
    const prop = root[path];

    if (typeof prop === 'undefined') {
      return null;
    }

    root = prop;
  }

  return root;
}

function getScriptLoader (dep, callback) {

  if (typeof document === 'undefined') {
    return null;
  }

  let { globalPath, url, jsonp } = dep;
  let scriptLoader = document.createElement('script');

  if (jsonp) {
    let callbackName = `_async_${globalPath.replace('.', '_')}`;
    url = `${url}${url.indexOf('?') > -1 ? '&' : '?'}callback=${callbackName}`;

    window[callbackName] = callback;
  } else {
    scriptLoader.onload = callback;
    scriptLoader.onreadystatechange = () => {
      if (this.readyState === 'loaded') {
        window.setTimeout(scriptLoader.onload, 0);
      }
    };
  }

  scriptLoader.async = 1;
  scriptLoader.src = url;

  return scriptLoader;
}

var asyncLoad = function (mapScriptsToProps) {

  function getInitialState (props) {
    const dependencies = mapScriptsToProps(props);

    return Object.keys(dependencies).reduce((states, name) => {
      return {
        ...states,
        [name]: getScript(dependencies[name].globalPath)
      };
    }, {});

  }

  return function (Component) {

    class AsyncLoaded extends React.Component {

      displayName = `AsyncLoaded(${getDisplayName(Component)})`;

      state = getInitialState(this.props);

      loadScripts (props) {
        const dependencies = mapScriptsToProps(props);

        Object.keys(dependencies)
          .filter(name => this.state[name] === null)
          .map(name => {
            const dep = dependencies[name];
            return getScriptLoader(dep, this.loadHandler.bind(this, name, dep.globalPath));
          })
          .forEach(scriptLoader => document ? document.body.appendChild(scriptLoader) : null);
      }

      componentDidMount () {
        this.loadScripts(this.props);
      }

      componentWillReceiveProps (nextProps) {
        this.setState(getInitialState(nextProps));
      }

      componentDidUpdate (nextProps) {
        this.loadScripts(nextProps);
      }

      loadHandler (name, globalPath) {
        let script = getScript(globalPath);

        if (script !== null) {
          this.setState({ [name]: script });
        }
      }

      injectScripts (component) {
        return React.cloneElement(
          React.createElement(component, this.props),
          this.state
        );
      }

      render () {
        return this.injectScripts(Component);
      }

    }

    return hoistStatics(AsyncLoaded, Component);

  };

};

export default asyncLoad;