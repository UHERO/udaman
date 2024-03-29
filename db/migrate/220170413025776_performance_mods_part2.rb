class PerformanceModsPart2 < ActiveRecord::Migration[5.2]
  def change
    execute 'update series set new_descrip = description, new_notes = investigation_notes;'
    execute 'update data_sources set new_eval = eval;'
    execute 'update measurements set new_notes = notes;'
    execute 'update data_source_actions set new_eval = eval;'
    execute 'update source_details set new_descrip = description;'

    change_column :series, :decimals, :integer, after: :universe
    remove_column :series, :description
    rename_column :series, :new_descrip, :description
    remove_column :series, :investigation_notes
    rename_column :series, :new_notes, :investigation_notes

    remove_column :data_lists, :list

    remove_column :data_sources, :eval
    rename_column :data_sources, :new_eval, :eval

    remove_column :measurements, :notes
    rename_column :measurements, :new_notes, :notes

    remove_column :data_source_actions, :eval
    rename_column :data_source_actions, :new_eval, :eval

    remove_column :source_details, :description
    rename_column :source_details, :new_descrip, :description
  end
end
