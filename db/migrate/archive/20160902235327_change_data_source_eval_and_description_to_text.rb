class ChangeDataSourceEvalAndDescriptionToText < ActiveRecord::Migration
  def change
    change_column :data_sources, :eval, :text
    change_column :data_sources, :description, :text
  end
end
