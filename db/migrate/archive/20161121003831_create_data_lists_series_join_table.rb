class CreateDataListsSeriesJoinTable < ActiveRecord::Migration[5.2]
  def change
    create_join_table :data_lists, :series do |t|
      t.index :data_list_id
    end
  end
end
