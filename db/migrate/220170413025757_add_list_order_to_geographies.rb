class AddListOrderToGeographies < ActiveRecord::Migration[5.2]
  def change
    change_column :geographies, :handle, :string, after: :fips    ### just to move this to a better "position" in db view
    add_column :geographies, :list_order, :integer, after: :display_name_short
  end
end
