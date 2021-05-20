class MoreForecastUniv < ActiveRecord::Migration[5.2]
  def self.up
    change_column :categories, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :data_lists, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :feature_toggles, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :units, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'

    change_column :data_sources, :series_id, :integer, after: :id
    change_column :data_sources, :dependencies, :text, after: :universe
    change_column :data_sources, :priority, :integer, after: :eval
  end

  def self.down
    change_column :categories, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :data_lists, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :feature_toggles, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :units, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
  end
end
