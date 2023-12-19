class AddDefaultHandleAndDefaultFreqToCategory < ActiveRecord::Migration[5.2]
  def change
    add_column :categories, :default_handle, :string
    add_column :categories, :default_freq, :string
  end
end
