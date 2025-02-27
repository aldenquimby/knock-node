import { version } from "../package.json";

import {
  BadRequestException,
  GenericServerException,
  NoApiKeyProvidedException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "./common/exceptions";
import {
  KnockOptions,
  PostAndPutOptions,
  MethodOptions,
} from "./common/interfaces";
import { Users } from "./resources/users";
import { Workflows } from "./resources/workflows";
import { TriggerWorkflowProperties } from "./resources/workflows/interfaces";
import { BulkOperations } from "./resources/bulk_operations";
import { Objects } from "./resources/objects";
import { Messages } from "./resources/messages";
import { Tenants } from "./resources/tenants";
import FetchClient, { FetchResponse } from "./common/fetchClient";
import {
  TokenEntity,
  TokenGrant,
  TokenGrantOptions,
} from "./common/userTokens";
import { Slack } from "./resources/slack";
import { signUserToken } from "./sign-user-token";

const DEFAULT_HOSTNAME = "https://api.knock.app";

class Knock {
  readonly host: string;
  private readonly client: FetchClient;

  // Service accessors
  readonly users = new Users(this);
  readonly workflows = new Workflows(this);
  readonly bulkOperations = new BulkOperations(this);
  readonly objects = new Objects(this);
  readonly messages = new Messages(this);
  readonly tenants = new Tenants(this);
  readonly slack = new Slack(this);

  constructor(readonly key?: string, readonly options: KnockOptions = {}) {
    if (!key) {
      this.key = process.env.KNOCK_API_KEY;

      if (!this.key) {
        throw new NoApiKeyProvidedException();
      }
    }

    this.host = options.host || DEFAULT_HOSTNAME;

    this.client = new FetchClient({
      baseURL: this.host,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "User-Agent": `knocklabs/node@${version}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  /**
   * Delegate the notify function to the workflows trigger
   *
   * @deprecated use workflows.trigger instead.
   */
  async notify(
    workflowKey: string,
    properties: TriggerWorkflowProperties,
    options?: MethodOptions,
  ) {
    return this.workflows.trigger(workflowKey, properties, options);
  }

  /**
   * Generate JWT for authenticating client-side requests (e.g. in-app feeds)
   * For more information, visit https://docs.knock.app/in-app-ui/security-and-authentication#authentication-with-enhanced-security-enabled
   *
   * @param userId {string} The ID of the user that needs a token, e.g. the user viewing an in-app feed.
   * @param options Optionally specify the signing key to use (in PEM or base-64 encoded format), and how long the token should be valid for in seconds
   * @returns {Promise<string>} A JWT token that can be used to authenticate requests to the Knock API (e.g. by passing into the <KnockFeedProvider /> component)
   */
  static signUserToken = signUserToken;

  /**
   * Helper function to build user token grants to pass to the `signUserToken` method.
   *
   * @param entity {TokenEntity} The type of entity to build a grant for
   * @param grants {TokenGrantOptions} A list of grants to give to the entity for the user
   *
   * @returns {TokenGrant} A single token grant that can be passed to the signUserToken function
   */
  static buildUserTokenGrant(
    entity: TokenEntity,
    grants: TokenGrantOptions,
  ): TokenGrant {
    return {
      entity: prepareTokenEntityUri(entity),
      grants: grants.reduce((acc, grant) => ({ ...acc, [grant]: [] }), {}),
    };
  }

  async post(
    path: string,
    entity: any,
    options: PostAndPutOptions = {},
  ): Promise<FetchResponse> {
    try {
      return await this.client.post(path, {
        params: options.query,
        headers: {
          ...options.headers,
        },
        body: entity,
      });
    } catch (error) {
      this.handleErrorResponse(path, error);
      throw error;
    }
  }

  async put(
    path: string,
    entity: any,
    options: PostAndPutOptions = {},
  ): Promise<FetchResponse> {
    try {
      return await this.client.put(path, {
        params: options.query,
        headers: {
          ...options.headers,
        },
        body: entity,
      });
    } catch (error) {
      this.handleErrorResponse(path, error);
      throw error;
    }
  }

  async delete(path: string, entity: any = {}): Promise<FetchResponse> {
    try {
      return await this.client.delete(path, {
        body: entity,
      });
    } catch (error) {
      this.handleErrorResponse(path, error);
      throw error;
    }
  }

  async get(path: string, query?: any): Promise<FetchResponse> {
    try {
      return await this.client.get(path, {
        params: query,
      });
    } catch (error) {
      this.handleErrorResponse(path, error);
      throw error;
    }
  }

  handleErrorResponse(path: string, error: any) {
    if (error.response) {
      const { status, data, headers } = error.response;
      const requestID = headers.get("X-Request-ID");

      switch (status) {
        case 401: {
          const { message, code } = data;
          throw new UnauthorizedException(code, message, requestID);
        }
        case 400: {
          const { message, code } = data;
          throw new BadRequestException(code, message, requestID);
        }
        case 422: {
          // Format errors as an array before passing to exception constructor
          const errors = !data.errors
            ? []
            : Array.isArray(data.errors)
            ? data.errors
            : [data.errors];

          throw new UnprocessableEntityException(errors, requestID);
        }
        case 404: {
          throw new NotFoundException(path, requestID);
        }
        default: {
          throw new GenericServerException(status, data.message, requestID);
        }
      }
    }
  }

  emitWarning(warning: string) {
    if (typeof process.emitWarning !== "function") {
      //  tslint:disable:no-console
      return console.warn(`Knock: ${warning}`);
    }

    return process.emitWarning(warning, "Knock");
  }
}

function prepareTokenEntityUri(entity: TokenEntity) {
  switch (entity.type) {
    case "user":
      return `${DEFAULT_HOSTNAME}/v1/users/${entity.id}`;
    case "tenant":
      return `${DEFAULT_HOSTNAME}/v1/objects/$tenants/${entity.id}`;
    case "object":
      return `${DEFAULT_HOSTNAME}/v1/objects/${entity.collection}/${entity.id}`;
  }
}

export { Knock };
