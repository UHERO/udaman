class RemoveLastObColumn < ActiveRecord::Migration[5.2]
  def change
    remove_column :public_data_points, :universe_ob if column_exists? :public_data_points, :universe_ob
    add_index :series, [:universe, :name], unique: true
  end
end
