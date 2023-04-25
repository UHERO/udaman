class AddFsDefaultRange < ActiveRecord::Migration[5.2]
  def change
    add_column :forecast_snapshots, :disp_from, :string, null: true, after: :published
    add_column :forecast_snapshots, :disp_to,   :string, null: true, after: :disp_start
  end
end
