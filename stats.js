import Stats from 'stats.js';

const stats = new Stats();

document.body.appendChild(stats.dom);

export default stats;

if (module.hot) {
    module.hot.dispose(function() {
        stats.dom.remove();
    });
}