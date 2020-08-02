class AddDefaultHandleAndDefaultFreqToCategory < ActiveRecord::Migration
  def change
    add_column :categories, :default_handle, :string
    add_column :categories, :default_freq, :string
  end
end
