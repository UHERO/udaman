class PerformanceModsPart2 < ActiveRecord::Migration[5.2]
  def change
    change_column :series, :decimals, :integer, after: :universe
    remove_column :series, :description
    rename_column :series, :new_descrip, :description
    remove_column :series, :investigation_notes
    rename_column :series, :new_notes, :investigation_notes

    #change_column :data_lists, :list, :text, after: :owned_by

    remove_column :data_sources, :eval
    rename_column :data_sources, :new_eval, :eval
    #change_column :data_sources, :description, :text, after: :last_error_at
    #change_column :data_sources, :dependencies, :text, after: :last_error_at

    remove_column :measurements, :notes
    rename_column :measurements, :new_notes, :notes

    remove_column :data_source_actions, :eval
    rename_column :data_source_actions, :new_eval, :eval

    remove_column :source_details, :description
    rename_column :source_details, :new_descrip, :description
  end
end
