class ChangeCatsDataListIdToForeignKey < ActiveRecord::Migration
  def change
    change_column :categories, :data_list_id, foreign_key: true
  end
end
