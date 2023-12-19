class ChangeKeyToApiKey < ActiveRecord::Migration[5.2]
  def change
    rename_column :api_applications, :key, :api_key
  end
end
