import { assertNonNull } from '@cloud-editor-mono/common';
import {
  SketchSecrets,
  sketchv2secret_CreateApi,
} from '@cloud-editor-mono/infrastructure';
import { uniqueId } from 'lodash';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { DeleteSecretDialogData } from '../sub-components/delete-secret-dialog/deleteSecretDialog.type';

export type UniqueSecret = sketchv2secret_CreateApi & {
  id: string;
};
export type UniqueSecretChange = Partial<UniqueSecret> & { id: string };

export type UseSecretEditor = (params: {
  sketchSecrets?: SketchSecrets;
  submitSecrets: (secrets?: SketchSecrets) => void;
  openDeleteSecretDialog: (data: DeleteSecretDialogData) => void;
}) => {
  secrets: UniqueSecret[];
  duplicates: Map<string, boolean>;
  changeSecret: (change: UniqueSecretChange) => void;
  deleteSecret: (id: string) => void;
  addSecret: () => void;
};

const SECRET_PREFIX = 'SECRET_';
const EMPTY_SECRET = { name: SECRET_PREFIX, value: undefined };

const makeUniqueSecrets = (secrets: SketchSecrets): UniqueSecret[] =>
  secrets.map((secret) => ({ ...secret, id: uniqueId() }));

export const makeEmptySecret = (): UniqueSecret => ({
  ...EMPTY_SECRET,
  id: uniqueId(),
});

export const isSecretEmpty = ({
  name,
  value,
}: sketchv2secret_CreateApi): boolean => {
  return !name.replace(SECRET_PREFIX, '') && !value;
};

const initialState = [makeEmptySecret()];

const getDuplicatesIds = (secrets: UniqueSecret[]): Map<string, boolean> => {
  const namesMap: Map<string, boolean> = new Map();
  const duplicatesMap: Map<string, boolean> = new Map();

  for (const secret of secrets) {
    const { id, name } = secret;

    if (name.replace(SECRET_PREFIX, '') && namesMap.get(name)) {
      duplicatesMap.set(id, true);
    }
    namesMap.set(name, true);
  }

  return duplicatesMap;
};

export const useSecretEditor: UseSecretEditor = function ({
  sketchSecrets,
  submitSecrets,
  openDeleteSecretDialog,
}): ReturnType<UseSecretEditor> {
  const [secrets, setSecrets] = useState(
    makeUniqueSecrets(sketchSecrets ?? initialState),
  );
  const [duplicates, setDuplicates] = useState<Map<string, boolean>>(
    new Map<string, boolean>(),
  );
  const [secretsToSubmit, setSecretsToSubmit] = useState<UniqueSecret[] | null>(
    null,
  );

  useDebounce(
    () => {
      if (secretsToSubmit) {
        propagateChanges(secretsToSubmit);
      }
    },
    300,
    [secretsToSubmit],
  );

  useEffect(() => {
    if (sketchSecrets) {
      // TODO should update secrets state if sketch changes and secret tab is open
    }
  }, [sketchSecrets]);

  useEffect(() => {
    setDuplicates(getDuplicatesIds(secrets));
  }, [secrets]);

  const addSecret = (): void => {
    setSecrets((prevValue) => prevValue.concat(makeEmptySecret()));
  };

  const changeSecret = (change: UniqueSecretChange): void => {
    setSecrets((prevValue) => {
      const { id, ...data } = change;

      const newValue = prevValue.map((secret) => {
        if (secret.id === id) {
          const value = { ...secret, ...data };
          value.name = value.name.replace(
            /[^a-zA-Z0-9-_]{1}[^a-zA-Z0-9-_.]{0,35}/g,
            '_',
          );
          return value;
        }
        return secret;
      });
      setSecretsToSubmit(newValue);

      return newValue;
    });
  };

  const deleteSecret = (id: string): void => {
    const secret = secrets.find((s) => s.id === id);
    assertNonNull(secret);

    const deleteSecretInner = (): void => {
      setSecrets((prevValue) => {
        const newValue = prevValue.filter((secret) => secret.id !== id);
        setSecretsToSubmit(newValue);

        return newValue.length === 0 ? initialState : newValue;
      });
    };

    if (isSecretEmpty(secret)) {
      return deleteSecretInner();
    }

    openDeleteSecretDialog({
      secretName: secret.name,
      onConfirm: () => deleteSecretInner(),
    });
  };

  const propagateChanges = (secrets: UniqueSecret[]): void => {
    const secretsToSubmit = (secrets || [])
      .filter((secret) => !isSecretEmpty(secret))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ id: _, ...data }) => data);
    submitSecrets(secretsToSubmit.length ? secretsToSubmit : undefined);
  };

  return {
    secrets,
    duplicates,
    changeSecret,
    addSecret,
    deleteSecret,
  };
};
