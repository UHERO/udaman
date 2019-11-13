class AddFreezeToDownloads < ActiveRecord::Migration[5.2]
  def change
       add_column :downloads, :freeze_dl, :boolean, null: true, after: :last_change_at
    remove_column :downloads, :save_path_obsolete            ## finally get rid of this
    change_column :downloads, :handle, :string, after: :id   ## just move it to the top of the table
  end
end
