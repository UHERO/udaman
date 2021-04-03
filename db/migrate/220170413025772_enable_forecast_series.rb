class EnableForecastSeries < ActiveRecord::Migration[5.2]
  def self.up
    change_column :series, :xseries_id, :integer, after: :id
    change_column :series, :geography_id, :integer, after: :id
    change_column :series, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :geographies, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :data_sources, :universe, %q(ENUM('UHERO','FC','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
  end

  def self.down
    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :geographies, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
    change_column :data_sources, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','CCOM')), null: false, default: 'UHERO'
  end
end
