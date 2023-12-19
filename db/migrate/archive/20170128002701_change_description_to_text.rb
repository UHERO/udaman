class ChangeDescriptionToText < ActiveRecord::Migration[5.2]
  def change
    change_column :series, :description, :text
  end
end
