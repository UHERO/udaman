class ChangeDescriptionToText < ActiveRecord::Migration
  def change
    change_column :series, :description, :text
  end
end
