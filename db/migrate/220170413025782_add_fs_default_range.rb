class AddFsDefaultRange < ActiveRecord::Migration[5.2]
  def change
    add_column :forecast_snapshots, :disp_start, :string, after: :published
    add_column :forecast_snapshots, :disp_end,   :string, after: :disp_start
  end
end
