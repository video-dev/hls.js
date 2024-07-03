const output = {
  instances: [],
  instanceNodes: [],
  callbacks: [],
  contexts: [],
  eventBindings: [],
  scripts: [],
  graph: [],
};

export function getInstanceEventListenerData(instance) {
  return loadJsContent(output.scripts).then(() => {
    walkObjectTree(instance);
    return output;
  });
}

let incrementalId = 0;
function genId() {
  return String(incrementalId++);
}

// Given an empty array or array of previous results, return a list of scripts and their content not already processed
// and add the results to the given array.
function loadJsContent(scripts = []) {
  const newScriptElements = [].filter.call(
    document.querySelectorAll('script'),
    (el) => !scripts.some((scr) => scr.element === el)
  );
  return Promise.all(
    newScriptElements.map((el, i) => {
      if (el.src) {
        return fetch(el.src)
          .then((response) => response.text())
          .then((script) => ({
            id: genId(),
            type: 'script',
            name: el.src.replace(/^.*\/([^/]+)(?:\?.*)?$/, '$1'),
            classes: [],
            functions: [],
            element: el,
            url: el.src,
            index: i,
            script,
          }));
      }
      return Promise.resolve({
        id: genId(),
        type: 'script',
        name: `script-${i}`,
        classes: [],
        functions: [],
        element: el,
        url: `${location.href}:${i}`,
        index: i,
        script: el.textContent,
      });
    })
  ).then((newScripts) => {
    [].push.apply(scripts, newScripts);
    newScripts.forEach((script) =>
      output.graph.push({
        group: 'nodes',
        data: script,
      })
    );
    return newScripts;
  });
}

function walkObjectTree(instance, parentNode, parentProperty) {
  if (!instance) {
    return null;
  }
  if (Object(instance) !== instance || typeof instance === 'function') {
    return null;
  }
  if (output.instances.includes(instance)) {
    return output.instanceNodes[output.instances.indexOf(instance)];
  }
  output.instances.push(instance);
  if (Object(instance.trigger) !== instance.trigger) {
    Object.entries(instance).forEach(([property, val]) =>
      walkObjectTree(val, parentNode, property)
    );
    return;
  }
  const constructorText = instance.constructor
    ? instance.constructor.toString()
    : null;
  const classScript = constructorText
    ? output.scripts.find(({ script }) => {
        return script.includes(constructorText);
      })
    : null;
  const classLocation = classScript ? classScript.name : null;
  const constructorName = instance.constructor
    ? instance.constructor.name
    : 'Object';
  const instanceNode = {
    group: 'nodes',
    data: {
      id: genId(),
      type: 'instance',
      name: constructorName,
      eventNodes: {},
    },
  };
  output.instanceNodes[output.instances.length - 1] = instanceNode;
  if (parentNode) {
    instanceNode.data.parent = parentNode.data.id;
    if (parentProperty) {
      instanceNode.data.name = `.${parentProperty}: ${instanceNode.data.name}`;
    }
  }
  if (classScript) {
    //  && !classScript.classes.includes(instance.constructor.name)
    let classNode = classScript.classes.find(
      (node) => node.data.name === `class ${constructorName}`
    );
    if (!classNode) {
      classNode = {
        group: 'nodes',
        data: {
          id: genId(),
          type: 'class',
          parent: classScript.id,
          name: `class ${constructorName}`,
          instances: [],
        },
      };
      classScript.classes.push(classNode);
      output.graph.push(classNode);
    }
    classNode.data.instances.push(instance);
    instanceNode.data.parent = classNode.data.id;
    instanceNode.data.name = `${constructorName} (${classNode.data.instances.length})`;
  }
  output.graph.push(instanceNode);
  Object.entries(instance).forEach(([property, val]) =>
    walkObjectTree(val, instanceNode, property)
  );
  if (Object(instance._events) !== instance._events) {
    return null;
  }
  Object.entries(instance._events).reduce(
    (collection, [name, callbackList]) => {
      const { callbacks, contexts, eventBindings } = collection;
      const walkCallback = ({ callback, fn, context }) => {
        // Hls.js `_events` have a `fn` callback property rather than `callback`
        callback = callback || fn;
        if (!callbacks.includes(callback)) {
          callbacks.push(callback);
        }
        // if (callback.boundObject) {
        //     console.log(callback.boundObject);
        // }
        context = callback.boundObject || context;
        if (!contexts.includes(context)) {
          contexts.push(context);
        }
        const functionName = callback.name;
        const functionText = callback.toString();
        const functionScript = output.scripts.find(({ script }) => {
          return script.includes(functionText);
        });
        const functionLocation = functionScript ? functionScript.name : null;
        eventBindings.push({
          instance,
          // constructor,
          classLocation,
          name,
          callback,
          context,
          parent,
          functionLocation,
          functionText,
        });

        const contextNode = walkObjectTree(context);
        let eventNode = instanceNode.data.eventNodes[name];
        if (!eventNode) {
          eventNode = {
            group: 'nodes',
            data: {
              id: genId(),
              type: 'event',
              parent: instanceNode.data.id,
              name: `on("${name}")`,
            },
          };
          instanceNode.data.eventNodes[name] = eventNode;
          output.graph.push(eventNode);
        }
        if (contextNode) {
          output.graph.push({
            group: 'edges',
            data: {
              id: genId(),
              name,
              source: eventNode.data.id,
              target: contextNode.data.id,
            },
          });
        } else if (functionName) {
          const functionNode = {
            group: 'nodes',
            data: {
              id: genId(),
              type: 'function',
              parent: contextNode
                ? contextNode.data.id
                : functionScript
                  ? functionScript.id
                  : null,
              name: `${functionName}()`,
            },
          };
          output.graph.push(functionNode);
          output.graph.push({
            group: 'edges',
            data: {
              id: genId(),
              name,
              source: eventNode.data.id,
              target: functionNode.data.id,
            },
          });
        } else if (functionScript) {
          output.graph.push({
            group: 'edges',
            data: {
              id: genId(),
              name,
              source: eventNode.data.id,
              target: functionScript.id,
            },
          });
        }
      };
      if (Array.isArray(callbackList)) {
        callbackList.forEach(walkCallback);
      } else {
        walkCallback(callbackList);
      }
      return collection;
    },
    output
  );

  return instanceNode;
}
