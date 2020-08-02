class AddPseudoHistoryToPublicDataPoints < ActiveRecord::Migration
  def change
    add_column :public_data_points, :pseudo_history, :boolean, null: false, default: false, after: :value
  end
end
