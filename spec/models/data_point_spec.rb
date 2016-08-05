require 'spec_helper'

describe DataPoint do
  before(:each) do
    @s = Series.create
  end
  
  #redo tests above without the update function
  it 'should not change data_point if value and source_id are unchanged' do
    ds = DataSource.create
    dp = DataPoint.create(:series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds.id, :current => true)
    dp.upd(100, ds)
    dpu = @s.data_points[0]
    expect(dpu.value).to eq(dp.value)
    expect(dpu.current).to eq(dp.current)
    expect(dpu.data_source_id).to eq(dp.data_source_id)
  end
  
  it 'should update a data_points source_id if source_id is different' do
    ds1 = DataSource.create
    ds2 = DataSource.create
    dp = DataPoint.create(:series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds1.id, :current => true)
    dp.upd(100, ds2)
    
    dpu = @s.current_data_points[0]
    expect(dpu.value).to eq(dp.value), 'not the same value'
    expect(dp.current).to eq(false), 'old data point still current'

    expect(dpu.data_source_id).to eq(ds2.id), 'ds2 does not have the same id'
    expect(dpu.data_source_id).not_to eq(ds1.id), 'ds1 does have the same id'
  end
  
  # it 'should be able to clone itself but assign a new value, source_id' do
  # end
  
  it 'should mark itself as non-current and spawn a new data point if the value of the data point changes' do
    ds1 = DataSource.create
    dp = DataPoint.create(:series_id => @s.id, :date => '2011-03-01', :value => 100.0, :data_source_id => ds1.id, :current => true)
    dp.upd(200, ds1)
    expect(DataPoint.count).to eq(2)
    expect(@s.current_data_points.count).to eq(1)
    expect(@s.data_points.count).to eq(2)
  end
    
  it "should make its 'next of kin' data point current if it's being deleted" do
    ds1 = DataSource.create
    dp = DataPoint.create(
        :series_id => @s.id,
        :date => '2011-03-01',
        :value => 100.0,
        :data_source_id => ds1.id,
        :current => true
    )

    sleep 1
    dp.upd(200, ds1)
    
    expect(@s.data_points.count).to eq(2)
    expect(@s.current_data_points.count).to eq(1)
    
    @s.current_data_points[0].delete

    expect(@s.data_points.count).to eq(1)
    expect(@s.current_data_points.count).to eq(1)
    expect(@s.current_data_points[0].id.to_s).to eq(dp.id.to_s)

    sleep 1  
    dp = DataPoint.where(:current => true).first
    dp2 = dp.upd(300, ds1)
      
    sleep 1
    dp2.upd(400, ds1)

  
    @s.current_data_points[0].delete

    expect(@s.data_points.count).to eq(2)
    expect(@s.current_data_points.count).to eq(1)
    expect(@s.current_data_points[0].id.to_s).to eq(dp2.id.to_s)
  end
end

