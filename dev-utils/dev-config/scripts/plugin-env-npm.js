module.exports = {
  name: 'plugin-env-npm',
  factory: () => ({
    hooks: {
      async getNpmAuthenticationHeader() {
        let token = process.env.NPM_TOKEN;

        if (!token) {
          const fs = require('fs/promises');
          const envContent = await fs.readFile('.env', 'utf8');

          const rows = envContent.split(/\r?\n/);
          for (const row of rows) {
            const [key, value] = row.split('=', 2);
            if (key.trim() === 'NPM_TOKEN') {
              token = value.trim();
            }
          }
        }

        if (token) {
          return `Bearer ${token}`;
        }
      },
    },
  }),
};

// // workaround needed to inject NPM_TOKEN var from '.env' in yarn 3,
// // ref: https://stackoverflow.com/questions/76703784/how-can-i-access-environment-varibale-declared-in-env-file-from-yarnrc-yaml-fi
