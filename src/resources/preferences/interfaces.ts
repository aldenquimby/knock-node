import { ChannelType, Condition } from "../../common/interfaces";

export type ConditionalPreferenceSettings = {
  conditions: Condition[];
};

export type ChannelTypePreferences = {
  [K in ChannelType]?: boolean | ConditionalPreferenceSettings;
};

export type WorkflowPreferenceSetting =
  | boolean
  | { channel_types: ChannelTypePreferences }
  | ConditionalPreferenceSettings;

export interface WorkflowPreferences {
  [key: string]: WorkflowPreferenceSetting;
}

export interface SetPreferencesProperties {
  workflows?: WorkflowPreferences;
  categories?: WorkflowPreferences;
  channel_types?: ChannelTypePreferences;
}

export interface PreferenceSet {
  id: string;
  categories: WorkflowPreferences | null;
  workflows: WorkflowPreferences | null;
  channel_types: ChannelTypePreferences | null;
}

export interface PreferenceOptions {
  preferenceSet?: string;
}

export interface GetPreferencesOptions extends PreferenceOptions {
  tenant?: string;
}
