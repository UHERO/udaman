class ChangeKeyToApiKey < ActiveRecord::Migration
  def change
    rename_column :api_applications, :key, :api_key
  end
end
